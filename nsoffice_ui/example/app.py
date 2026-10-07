"""A minimal NSOffice app built only from the nsoffice_ui kit — copy this folder to start a new program.

Run from the repo root:   python nsoffice_ui/example/app.py   ->  http://localhost:5055
"""
import os
import sys

from flask import Flask, abort, redirect, render_template

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from nsoffice_ui import nsoffice_ui  # noqa: E402

app = Flask(__name__)
app.register_blueprint(nsoffice_ui)
app.config["NSOFFICE_UI"] = {
    "title": "Connectors — NSOffice.AI",
    "admin_settings": None,            # this app has no admin area
    "user": {"role_href": None},       # role badge is just a label here
}

CONNECTORS = [
    {"category": "design", "title": "Design", "groups": [{"name": "", "items": [
        {"icon": "palette", "title": "Canva", "desc": "Create, edit and export Canva designs from NSOffice", "slug": "canva"},
        {"icon": "pen-tool", "title": "Figma", "desc": "Pull frames and comments from Figma files", "slug": "figma"},
    ]}]},
    {"category": "workspace", "title": "Workspace", "groups": [{"name": "", "items": [
        {"icon": "hard-drive", "title": "Google Drive", "desc": "Search and read files in your Drive", "slug": "google-drive"},
        {"icon": "message-square", "title": "Slack", "desc": "Read channels and post updates", "slug": "slack"},
        {"icon": "book-open", "title": "Notion", "desc": "Use your Notion pages as context", "slug": "notion"},
    ]}]},
]
FILTERS = [{"category": "design", "label": "Design"}, {"category": "workspace", "label": "Workspace"}]


def find_connector(slug):
    for section in CONNECTORS:
        for group in section["groups"]:
            for item in group["items"]:
                if item["slug"] == slug:
                    return item
    return None


@app.route("/")
def index():
    return redirect("/hive")


@app.route("/home")
def home():
    return render_template("example_home.html")


@app.route("/hive")
def hive():
    return render_template("example_hive.html")


@app.route("/hive/connectors")
def connectors():
    return render_template("example_connectors.html", sections=CONNECTORS, filters=FILTERS)


@app.route("/connector/<slug>")
def connector(slug):
    item = find_connector(slug)
    if not item:
        abort(404)
    return render_template("example_connector.html", connector=item)


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5055)), debug=True)
