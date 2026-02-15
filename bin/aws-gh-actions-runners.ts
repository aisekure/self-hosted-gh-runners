#!/usr/bin/env node

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsGithubActionsSelfHostedRunnerAutoscalingStack } from '../lib/aws-gh-actions-runners-stack';
const { env } = require("process");

const app = new cdk.App();
new AwsGithubActionsSelfHostedRunnerAutoscalingStack(app, "AwsGithubActionsSelfHostedRunnerAutoscalingStack", {
  maxInstances: "4",
  //keypairName: env.AWS_KEYPAIR_NAME,
  runnerName: "aws-runner",
})