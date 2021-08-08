resource "aws_cloudwatch_log_group" "moggiez_driver" {
  name = "/aws/events/moggiez_driver"
}

module "driver_source_to_log_group" {
  source        = "git@github.com:moggiez/terraform-modules.git//eventrules_source_to_log_group"
  application   = "moggies-io"
  account       = var.account
  eventbus_name = var.eventbus_name
  event_source  = "Driver"
  log_group     = aws_cloudwatch_log_group.moggiez_driver
}