terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  # Uncomment the line below to switch from local to s3 terraform backend
  # backend "s3" {}
}

provider "aws" {
  region = var.region
}

provider "aws" {
  alias  = "acm_provider"
  region = "us-east-1"
}

data "aws_route53_zone" "public" {
  private_zone = false
  name         = var.domain_name
}

locals {
  environment = "PROD"

  hosted_zone = data.aws_route53_zone.public

  authorization_enabled = true


  # API GW Locals
  stages       = toset(["blue", "green"])
  stage        = "blue"
  http_methods = toset(["GET", "POST", "PUT", "DELETE"])
}


locals {
  authorizer = local.authorization_enabled ? aws_api_gateway_authorizer._ : null
}


resource "aws_api_gateway_rest_api" "_" {
  name        = "driver-api"
  description = "driver-api API"
}


resource "aws_api_gateway_authorizer" "_" {
  name          = "driver-api-UserAuthorizer"
  rest_api_id   = aws_api_gateway_rest_api._.id
  type          = "COGNITO_USER_POOLS"
  provider_arns = ["arn:aws:cognito-idp:${var.region}:${var.account}:userpool/${var.user_pool_id}"]
}
