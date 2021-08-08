
module "api_lambda" {
  source      = "git@github.com:moggiez/terraform-modules.git//lambda_with_dynamo"
  s3_bucket   = aws_s3_bucket._
  dist_dir    = "../dist"
  name        = "driver-api"
  environment = local.environment
  timeout     = 60
  policies = [
    aws_iam_policy.eventbridge_events.arn
  ]
}

resource "aws_lambda_permission" "_" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.api_lambda.lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api._.execution_arn}/*/*"
}