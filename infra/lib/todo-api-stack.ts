import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import * as path from "path";

export class TodoApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── VPC (パブリックサブネットのみ、NAT不要) ──────────────────────────────
    const vpc = new ec2.Vpc(this, "TodoApiVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // ── セキュリティグループ ─────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, "LambdaSg", {
      vpc,
      description: "todo-api Lambda",
      allowAllOutbound: true,
    });

    const rdsSg = new ec2.SecurityGroup(this, "RdsSg", {
      vpc,
      description: "todo-api RDS",
      allowAllOutbound: false,
    });
    // LambdaからのPostgreSQL(5432)のみ許可
    rdsSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to RDS");

    // ── RDS PostgreSQL db.t3.micro ─────────────────────────────────────────
    const dbSecret = new rds.DatabaseSecret(this, "DbSecret", {
      username: "todoapi",
    });

    const db = new rds.DatabaseInstance(this, "TodoApiDb", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [rdsSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: "todoapi",
      publiclyAccessible: false,
      storageEncrypted: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Secrets Manager (アプリシークレット) ─────────────────────────────────
    const appSecret = new secretsmanager.Secret(this, "AppSecret", {
      secretName: "todo-api/app",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          RESEND_API_KEY: "REPLACE_ME",
          ALLOWED_ORIGINS: "",
        }),
        generateStringKey: "BETTER_AUTH_SECRET",
        excludePunctuation: false,
        passwordLength: 44,
      },
    });

    // ── Lambda ────────────────────────────────────────────────────────────
    const fn = new lambda.Function(this, "TodoApiFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      // ルートのdistディレクトリ(事前にビルド済み)を参照
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dist-lambda")),
      handler: "lambda.handler",
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [lambdaSg],
      allowPublicSubnet: true,
      environment: {
        // DATABASE_URL はSecretsManager経由で動的に注入(起動時にfetch)
        // APP_URLはAPI Gateway URLが確定後にupdate-function-configurationで設定
        APP_URL: "https://placeholder.example.com",
        SKIP_EMAIL_VERIFICATION: "false",
      },
    });

    // SecretsManagerからDB接続情報・アプリシークレットを読み取る権限
    dbSecret.grantRead(fn);
    appSecret.grantRead(fn);

    // Lambda起動時にSecrets Managerからenvを取得するための拡張
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [dbSecret.secretArn, appSecret.secretArn],
      }),
    );

    // RDSエンドポイントをLambda環境変数に渡す（DATABASE_URLはSecrets拡張で組み立てるため参考値）
    fn.addEnvironment("DB_HOST", db.dbInstanceEndpointAddress);
    fn.addEnvironment("DB_PORT", db.dbInstanceEndpointPort);
    fn.addEnvironment("DB_SECRET_ARN", dbSecret.secretArn);
    fn.addEnvironment("APP_SECRET_ARN", appSecret.secretArn);

    // ── API Gateway HTTP API ──────────────────────────────────────────────
    const httpApi = new apigateway.HttpApi(this, "TodoApiGateway", {
      apiName: "todo-api",
      corsPreflight: {
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
      },
    });

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigateway.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration(
        "LambdaIntegration",
        fn,
      ),
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
      description: "API Gateway endpoint URL",
    });
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: db.dbInstanceEndpointAddress,
      description: "RDS endpoint (for migration)",
    });
    new cdk.CfnOutput(this, "DbSecretArn", {
      value: dbSecret.secretArn,
      description: "RDS credentials secret ARN",
    });
    new cdk.CfnOutput(this, "AppSecretArn", {
      value: appSecret.secretArn,
      description: "App secrets ARN (set RESEND_API_KEY here)",
    });
    new cdk.CfnOutput(this, "LambdaFunctionName", {
      value: fn.functionName,
      description: "Lambda function name",
    });
  }
}
