from pydantic import BaseModel, Field


class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=32000)
    model: str = Field(default="mira", pattern=r"^(mira|mira-thinking)$")


class ConversationCreate(BaseModel):
    title: str = Field(default="New chat", max_length=256)
    model: str = Field(default="mira", pattern=r"^(mira|mira-thinking)$")


class ConversationUpdate(BaseModel):
    title: str | None = None
    starred: bool | None = None
    archived: bool | None = None


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    steps: list | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    model: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    starred: bool
    archived: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ConversationWithMessages(ConversationResponse):
    messages: list[MessageResponse]


# OpenAI-compatible API format (for developer platform)
class ChatCompletionMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(default="mira", pattern=r"^(mira|mira-thinking)$")
    messages: list[ChatCompletionMessage]
    temperature: float = 0.7
    max_tokens: int | None = None
    stream: bool = False


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatCompletionMessage
    finish_reason: str


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage
