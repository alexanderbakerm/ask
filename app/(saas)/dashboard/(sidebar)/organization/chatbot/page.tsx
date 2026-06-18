import { redirect } from "next/navigation";

// The generic GPT chatbot has been replaced by the database-connected
// AskBI assistant, which now lives at /dashboard/organization/ask and is
// surfaced in the product as "AI Chatbot". Redirect any old links here.
export default function ChatbotPage(): never {
	redirect("/dashboard/organization/ask");
}
