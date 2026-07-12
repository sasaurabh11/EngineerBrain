from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage

from app.agents.schemas import ChatMessagePayload, ToolCallPayload

_THOUGHT_SIGNATURES_KEY = "__gemini_function_call_thought_signatures__"


def to_langchain_messages(payloads: list[ChatMessagePayload]) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for payload in payloads:
        if payload.role == "user":
            messages.append(HumanMessage(content=payload.content or ""))
        elif payload.role == "assistant":
            tool_calls = (
                [{"name": tc.name, "args": tc.args, "id": tc.id, "type": "tool_call"} for tc in payload.tool_calls]
                if payload.tool_calls
                else []
            )
            signatures = {tc.id: tc.signature for tc in (payload.tool_calls or []) if tc.signature}
            additional_kwargs = {_THOUGHT_SIGNATURES_KEY: signatures} if signatures else {}
            messages.append(AIMessage(content=payload.content or "", tool_calls=tool_calls, additional_kwargs=additional_kwargs))
        elif payload.role == "tool":
            messages.append(ToolMessage(content=payload.content or "", tool_call_id=payload.tool_call_id or "", name=payload.name))
    return messages


def from_ai_message(message: AIMessage) -> ChatMessagePayload:
    signatures = message.additional_kwargs.get(_THOUGHT_SIGNATURES_KEY, {})
    tool_calls = (
        [
            ToolCallPayload(id=tc["id"], name=tc["name"], args=tc.get("args", {}), signature=signatures.get(tc["id"]))
            for tc in message.tool_calls
        ]
        if message.tool_calls
        else None
    )
    return ChatMessagePayload(role="assistant", content=message.text or None, tool_calls=tool_calls)
