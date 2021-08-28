resource "aws_iam_policy" "eventbridge_events" {
  name        = "driver-api_eventbridge_access"
  path        = "/"
  description = "IAM policy for logging from driver-api lambda"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : "events:PutEvents",
        "Resource" : "*"
      }
    ]
  })
}

resource "aws_iam_policy" "invoke_lambda" {
  name        = "${var.domain_name}-driver-api-InvokeLambda"
  path        = "/"
  description = "IAM policy for invoking lambda functions"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction",
          "lambda:InvokeAsync"
        ],
        "Resource" : "arn:aws:lambda:${var.region}:${var.account}:*"
      }
    ]
  })
}