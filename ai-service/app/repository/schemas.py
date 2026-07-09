from pydantic import BaseModel


class FileContentRequest(BaseModel):
    repository_id: str
    clone_url: str
    access_token: str
    default_branch: str
    file_path: str


class FileContentResponse(BaseModel):
    content: str
