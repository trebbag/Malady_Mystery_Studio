terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.26"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.name_prefix}-logs"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "this" {
  name                = "${var.name_prefix}-appi"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = "web"
}

resource "azurerm_storage_account" "this" {
  name                            = var.storage_account_name
  resource_group_name             = azurerm_resource_group.this.name
  location                        = azurerm_resource_group.this.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = false
  min_tls_version                 = "TLS1_2"

  blob_properties {
    delete_retention_policy {
      days = 14
    }

    versioning_enabled = true
  }
}

resource "azurerm_storage_container" "artifacts" {
  name                  = var.blob_container_name
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

resource "azurerm_servicebus_namespace" "this" {
  name                = "${var.name_prefix}-sb"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "Standard"
}

resource "azurerm_servicebus_queue" "render_execution" {
  name         = "render-execution"
  namespace_id = azurerm_servicebus_namespace.this.id
}

resource "azurerm_key_vault" "this" {
  name                        = var.key_vault_name
  location                    = azurerm_resource_group.this.location
  resource_group_name         = azurerm_resource_group.this.name
  tenant_id                   = var.tenant_id
  sku_name                    = "standard"
  purge_protection_enabled    = false
  soft_delete_retention_days  = 7
  enabled_for_disk_encryption = false
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                   = "${var.name_prefix}-pg"
  resource_group_name    = azurerm_resource_group.this.name
  location               = azurerm_resource_group.this.location
  version                = "16"
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password
  zone                   = "1"
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  name      = var.postgres_database_name
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_container_app_environment" "this" {
  name                       = "${var.name_prefix}-env"
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
}

resource "azurerm_container_app" "api" {
  name                         = "${var.name_prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = azurerm_resource_group.this.name
  revision_mode                = "Single"

  ingress {
    external_enabled = false
    target_port      = 3000
    transport        = "auto"
  }

  template {
    container {
      name   = "api"
      image  = var.api_image
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "ASYNC_QUEUE_BACKEND"
        value = "azure-service-bus"
      }
    }
  }
}

resource "azurerm_container_app" "worker" {
  name                         = "${var.name_prefix}-worker"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = azurerm_resource_group.this.name
  revision_mode                = "Single"

  template {
    container {
      name   = "worker"
      image  = var.worker_image
      cpu    = 0.5
      memory = "1.0Gi"
    }
  }
}

