import {
  aws_secretsmanager as secretsmanager,
  aws_events as events,
  aws_ec2 as ec2,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_autoscaling as autoscaling,
  aws_events_targets as targets,
  Duration,
  Stack,
  SecretValue,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import * as cdk from "aws-cdk-lib";
const { env } = require("process");

export interface AwsGithubActionsSelfHostedRunnerAutoscalingStackProps extends cdk.StackProps {
  maxInstances: string;
  //keypairName: string;
  runnerName: string;
}

export class AwsGithubActionsSelfHostedRunnerAutoscalingStack extends Stack {
  constructor(scope: Construct, id: string, props?: AwsGithubActionsSelfHostedRunnerAutoscalingStackProps) {
    super(scope, id, props);
    // configuring EC2
    const githubActionsVpc = new ec2.Vpc(this, "GithubActionsSelfHostedRunnerVPC", {
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: "public-subnet-1",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const githubActionsSecurityGroup = new ec2.SecurityGroup(
      this,
      "GithubActionsSelfHostedRunnerSecurityGroup",
      {
        vpc: githubActionsVpc,
      }
    );

    githubActionsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "allow ssh from the internet"
    );

    const instanceTypeName = "t3.micro";
    const instanceType = new ec2.InstanceType(instanceTypeName);

    const amiSamParameterName =
      "/aws/service/canonical/ubuntu/server/focal/stable/current/amd64/hvm/ebs-gp2/ami-id";

    const ami = ec2.MachineImage.fromSsmParameter(amiSamParameterName, {
      os: ec2.OperatingSystemType.LINUX,
    });

    const githubActionsAutoScalingGroup = new autoscaling.AutoScalingGroup(
      this,
      "GithubActionsSelfHostedRunnerASG",
      {
        vpc: githubActionsVpc,
        instanceType: instanceType,
        machineImage: ami,
        securityGroup: githubActionsSecurityGroup,
        //keyName: props!!.keypairName,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        minCapacity: 0,
        maxCapacity: Number(props!!.maxInstances),
      }
    );

    let userDataScript = readFileSync("./scripts/install_script.sh", "utf8");
    userDataScript = userDataScript.replace(
      "<GITHUB_OWNER>",
      env.GITHUB_OWNER
    );
    userDataScript = userDataScript.replace(
      "<REPOSITORY_NAME>",
       env.REPOSITORY_NAME //props!!.runnerName
    );
    
    githubActionsAutoScalingGroup.addUserData(userDataScript);
    const githubAuthSecret = new secretsmanager.Secret(this, "GithubActionsSelfHostedRunnerSecret", {
      secretName: "github-actions-self-hosted-runner-secret",
      // secretObjectValue: {
      //   resource_class: SecretValue.unsafePlainText(env.SELF_HOSTED_RUNNER_RESOURCE_CLASS),
      //   circle_token: SecretValue.unsafePlainText(env.CIRCLECI_TOKEN),
      // },
    });

    const lambdaPolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [githubActionsAutoScalingGroup.autoScalingGroupArn],
          actions: ["autoscaling:UpdateAutoScalingGroup"],
        }),
        new iam.PolicyStatement({
          resources: [githubAuthSecret.secretArn],
          actions: ["secretsmanager:GetSecretValue"],
        }),
      ],
    });

    const inferenceLambdaRole = new iam.Role(this, `GithubActionsSelfHostedAutoScalingLambdaRole`, {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Role assumed by auto scaling lambda",
      inlinePolicies: {
        lambdaPolicy: lambdaPolicyDocument,
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });
    const autoScalingLambda = new lambda.Function(
      this,
      "GithubActionsSelfHostedRunnerAutoScalingLambda",
      {
        functionName: "GithubActionsSelfHostedRunnerAutoScalingLambda",
        code: lambda.Code.fromAsset("./lambda/auto-scaling-lambda/"),
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: "index.handler",
        environment: {
          SECRET_NAME: githubAuthSecret.secretName,
          SECRET_REGION: props?.env?.region || "us-east-1",
          AUTO_SCALING_MAX: props!!.maxInstances,
          AUTO_SCALING_GROUP_NAME: githubActionsAutoScalingGroup.autoScalingGroupName,
          AUTO_SCALING_GROUP_REGION: props?.env?.region || "us-east-1",
        },
        timeout: Duration.minutes(1),
        role: inferenceLambdaRole,
      }
    );

    const eventRule = new events.Rule(this, "GithubActionsSelfHostedLambdaSchedule", {
      schedule: events.Schedule.rate(Duration.minutes(1)),
    });
    eventRule.addTarget(new targets.LambdaFunction(autoScalingLambda));
  }
}