// Route /{organisationId}
module "organisationId_param" {
  source             = "git@github.com:moggiez/terraform-modules.git//lambda_gateway"
  api                = aws_api_gateway_rest_api._
  lambda             = module.api_lambda.lambda
  http_methods       = local.http_methods
  resource_path_part = "{organisationId}"

  authorizer = local.authorizer

}

module "organisationId_param_cors" {
  source          = "git@github.com:moggiez/terraform-modules.git//api_gateway_enable_cors"
  api_id          = aws_api_gateway_rest_api._.id
  api_resource_id = module.organisationId_param.api_resource.id
}

// Route /{organisattionId}/run
module "run_part" {
  source             = "git@github.com:moggiez/terraform-modules.git//lambda_gateway"
  api                = aws_api_gateway_rest_api._
  parent_resource    = module.organisationId_param.api_resource
  lambda             = module.api_lambda.lambda
  http_methods       = local.http_methods
  resource_path_part = "run"

  authorizer = local.authorizer

}

module "run_part_cors" {
  source          = "git@github.com:moggiez/terraform-modules.git//api_gateway_enable_cors"
  api_id          = aws_api_gateway_rest_api._.id
  api_resource_id = module.run_part.api_resource.id
}

// Route /{organisationId}/run/{loadtestId}
module "loadtestId_part" {
  source             = "git@github.com:moggiez/terraform-modules.git//lambda_gateway"
  api                = aws_api_gateway_rest_api._
  parent_resource    = module.run_part.api_resource
  lambda             = module.api_lambda.lambda
  http_methods       = local.http_methods
  resource_path_part = "{loadtestId}"

  authorizer = local.authorizer

}

module "loadtestId_part_cors" {
  source          = "git@github.com:moggiez/terraform-modules.git//api_gateway_enable_cors"
  api_id          = aws_api_gateway_rest_api._.id
  api_resource_id = module.loadtestId_part.api_resource.id
}