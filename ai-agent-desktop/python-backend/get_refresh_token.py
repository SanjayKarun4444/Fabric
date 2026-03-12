# get_refresh_token.py
import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/calendar",
]

# Locate the client_secrets file (it may be in repo root)
# DEFAULT_CREDENTIALS_NAME = "client_secret_800333772675-8vj53o4losf2pbaf0fq869jumnslg5kp.apps.googleusercontent.com.json"
DEFAULT_CREDENTIALS_NAME = "client_secret_336721658955-2ukit9dcgk16bu6tgdu341lj8h5deqal.apps.googleusercontent.com.json"
search_paths = [
    os.path.join(os.path.dirname(__file__), DEFAULT_CREDENTIALS_NAME),
    os.path.join(os.path.dirname(__file__), "..", DEFAULT_CREDENTIALS_NAME),
    os.path.join(os.path.dirname(__file__), "..", "..", DEFAULT_CREDENTIALS_NAME),
]

client_secrets_path = None
for p in search_paths:
    if os.path.exists(p):
        client_secrets_path = os.path.abspath(p)
        break

if not client_secrets_path:
    raise FileNotFoundError(
        f"Unable to find {DEFAULT_CREDENTIALS_NAME}. Looked in:\n" + "\n".join(search_paths)
    )

flow = InstalledAppFlow.from_client_secrets_file(client_secrets_path, SCOPES)
creds = flow.run_local_server(port=0)
print("REFRESH_TOKEN=", creds.refresh_token)