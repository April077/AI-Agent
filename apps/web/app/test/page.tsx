export default function TestPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-500">
      <div className="text-white text-center">
        <h1 className="text-4xl font-bold mb-4">✅ Test Page Works!</h1>
        <p className="text-xl">Next.js is responding correctly</p>
        <p className="mt-4">Time: {new Date().toISOString()}</p>
      </div>
    </div>
  );
}