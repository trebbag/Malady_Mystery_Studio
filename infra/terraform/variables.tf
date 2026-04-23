variable "subscription_id" {
  type        = string
  description = "Azure subscription id for the pilot environment."
}

variable "tenant_id" {
  type        = string
  description = "Azure Entra tenant id used for Key Vault."
}

variable "location" {
  type        = string
  description = "Primary Azure region."
  default     = "eastus2"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group that will hold the pilot environment."
}

variable "name_prefix" {
  type        = string
  description = "Short prefix used for generated resource names."
}

variable "storage_account_name" {
  type        = string
  description = "Globally unique storage account name."
}

variable "blob_container_name" {
  type        = string
  description = "Primary private blob container for artifacts and rendered assets."
  default     = "dcp-artifacts"
}

variable "key_vault_name" {
  type        = string
  description = "Globally unique key vault name."
}

variable "postgres_admin_username" {
  type        = string
  description = "Admin username for PostgreSQL Flexible Server."
}

variable "postgres_admin_password" {
  type        = string
  description = "Admin password for PostgreSQL Flexible Server."
  sensitive   = true
}

variable "postgres_database_name" {
  type        = string
  description = "Primary metadata database name."
  default     = "dcp_platform"
}

variable "api_image" {
  type        = string
  description = "Container image reference for the API app."
}

variable "worker_image" {
  type        = string
  description = "Container image reference for the async worker."
}

