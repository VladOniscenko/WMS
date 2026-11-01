#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="$root/artifacts/nuget"
rm -rf "$output"
mkdir -p "$output"
for project in \
  "$root/backend/src/StudioPlatform.Shared/StudioPlatform.Shared.csproj" \
  "$root/backend/src/Modules/StudioPlatform.Modules.Business/StudioPlatform.Modules.Business.csproj" \
  "$root/backend/src/Modules/StudioPlatform.Modules.Core/StudioPlatform.Modules.Core.csproj" \
  "$root/backend/src/Modules/StudioPlatform.Modules.Auth/StudioPlatform.Modules.Auth.csproj" \
  "$root/backend/src/Modules/StudioPlatform.Modules.Customers/StudioPlatform.Modules.Customers.csproj" \
  "$root/backend/src/Modules/StudioPlatform.Modules.Employees/StudioPlatform.Modules.Employees.csproj" \
  "$root/backend/src/Modules/StudioPlatform.Modules.Agenda/StudioPlatform.Modules.Agenda.csproj"; do
  dotnet pack "$project" -c Release -o "$output"
done
