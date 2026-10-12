# Shared target admission for the public local dependency commands.
LOCAL_DEV_CONTEXT=orbstack
local_dev_current_context=$(kubectl config current-context)
if [ "$local_dev_current_context" != "$LOCAL_DEV_CONTEXT" ]; then
  echo "Refusing non-local context: $local_dev_current_context (expected $LOCAL_DEV_CONTEXT)" >&2
  exit 1
fi

local_dev_kubectl() {
  command kubectl --context="$LOCAL_DEV_CONTEXT" "$@"
}
