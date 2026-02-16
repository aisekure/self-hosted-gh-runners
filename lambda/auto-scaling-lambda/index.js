const AWS = require("aws-sdk");
const fetch = require("node-fetch");
AWS.config.update({ region: "us-east-1" });
const { env } = require("process");

const SECRET_NAME = env.SECRET_NAME;
const SECRET_REGION = env.SECRET_REGION;
const AUTO_SCALING_MAX = env.AUTO_SCALING_MAX;
const AUTO_SCALING_GROUP_NAME = env.AUTO_SCALING_GROUP_NAME;
const AUTO_SCALING_GROUP_REGION = env.AUTO_SCALING_GROUP_REGION;

const GITHUB_API = "https://api.github.com";

exports.handler = async () => {
  const queuedJobs = await getQueuedJobs();
  const numInstances = queuedJobs < AUTO_SCALING_MAX ? queuedJobs : AUTO_SCALING_MAX;
  await updateNumInstances(numInstances);
  return numInstances;
};

async function updateNumInstances(numInstances) {
  const autoScaling = new AWS.AutoScaling({ region: AUTO_SCALING_GROUP_REGION });
  const params = {
    AutoScalingGroupName: AUTO_SCALING_GROUP_NAME,
    MinSize: 0,
    MaxSize: AUTO_SCALING_MAX,
    DesiredCapacity: numInstances,
  };
  await autoScaling.updateAutoScalingGroup(params).promise();
}

async function getQueuedJobs() {
  github_token = env.GITHUB_AUTH_TOKEN
  github_owner = env.GITHUB_OWNER
  owner_type   = env.GITHUB_OWNER_TYPE
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${github_token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  }

  const repos = await getRepos(github_owner, owner_type, headers);
  let queuedJobs = 0;
  for (const repo of repos) {
    const runs = await getWorkflowRuns(
      github_owner,
      repo.name,
      headers
    );
    for (const run of runs) {
      const jobs = await getJobs(
        github_owner,
        repo.name,
        run.id,
        headers
      );
      queuedJobs += jobs.filter(
        (job) => job.status === "queued"
      ).length;
    }
  }
  return queuedJobs;
};

async function getRepos(owner, ownerType, headers) {
  const url =
    ownerType === "org"
      ? `${GITHUB_API}/orgs/${owner}/repos`
      : `${GITHUB_API}/users/${owner}/repos`;
  const res = await fetch(url, { headers });
  return await res.json();
}

async function getWorkflowRuns(owner, repo, headers) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.workflow_runs || [];
}

async function getJobs(owner, repo, runId, headers) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.jobs || [];
}

async function getSecret() {
  const data = await new AWS.SecretsManager({ region: SECRET_REGION })
    .getSecretValue({ SecretId: SECRET_NAME })
    .promise();
  if (data.SecretString) {
    return JSON.parse(data.SecretString);
  }
  return JSON.parse(
    Buffer.from(data.SecretBinary, "base64").toString("ascii")
  );
}
