output "resource_group_name" {
  value = azurerm_resource_group.this.name
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.this.id
}

output "blob_container_name" {
  value = azurerm_storage_container.artifacts.name
}

output "postgres_server_name" {
  value = azurerm_postgresql_flexible_server.this.name
}

output "service_bus_namespace_name" {
  value = azurerm_servicebus_namespace.this.name
}

output "application_insights_connection_string" {
  value     = azurerm_application_insights.this.connection_string
  sensitive = true
}
