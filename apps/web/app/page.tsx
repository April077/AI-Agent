import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";
import SignInButton from "../components/SignInButton";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  console.log("Session on landing page:", session);

  return (
    <main className="flex flex-col min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-32 px-6 text-center relative overflow-hidden flex flex-col items-center">
        <div className="max-w-4xl mx-auto z-10 relative flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
            Your AI Agent for{" "}
            <span className="text-yellow-300">Email, Tasks & Automation</span>
          </h1>
          <p className="text-lg md:text-xl mb-8 text-center">
            Summarize emails, schedule meetings, automate workflows, and connect
            your apps — all in one intelligent assistant.
          </p>

          {/* ✅ Show Sign Out if logged in, else Sign In */}
          {session ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg">Signed in as {session.user?.email}</p>
              <SignInButton signedIn={true} />
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <SignInButton signedIn={false} />
            </div>
          )}
        </div>

        {/* Decorative floating shapes */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-yellow-300 opacity-20 rounded-full -translate-x-32 -translate-y-32"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full translate-x-32 translate-y-32"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-white text-gray-800">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12 text-center">
          <div className="p-6 shadow-lg rounded-2xl hover:shadow-2xl hover:-translate-y-2 transition-transform duration-300">
            <h2 className="text-2xl font-semibold mb-4">Email Summarizer</h2>
            <p>
              Quickly understand your inbox with AI-powered email summaries,
              saving hours of reading time.
            </p>
          </div>
          <div className="p-6 shadow-lg rounded-2xl hover:shadow-2xl hover:-translate-y-2 transition-transform duration-300">
            <h2 className="text-2xl font-semibold mb-4">Task Scheduler</h2>
            <p>
              Automatically schedule meetings and tasks from emails or messages,
              synced across your calendar.
            </p>
          </div>
          <div className="p-6 shadow-lg rounded-2xl hover:shadow-2xl hover:-translate-y-2 transition-transform duration-300">
            <h2 className="text-2xl font-semibold mb-4">App Integrations</h2>
            <p>
              Connect your favorite apps like Slack, Notion, or Google Workspace
              and automate your workflow seamlessly.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!session && (
        <section className="py-20 px-6 bg-gray-800 text-center flex flex-col items-center">
          <h2 className="text-3xl md:text-4xl text-white font-bold mb-6">
            Ready to boost your productivity with AI?
          </h2>
          <p className="text-lg text-white mb-8">
            Sign in with Google and let your intelligent assistant handle the rest.
          </p>
          <SignInButton signedIn={false} />
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} YourAIApp. All rights reserved.
      </footer>
    </main>
  );
}
