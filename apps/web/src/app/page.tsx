export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tight">
          Quest<span className="text-primary-500">Dreamer</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-md mx-auto">
          Your P2P-powered Virtual Tabletop for epic TTRPG adventures.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <button className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition-colors duration-200">
            Get Started
          </button>
          <button className="px-6 py-3 border border-primary-600/50 hover:border-primary-500 text-primary-300 font-semibold rounded-xl transition-colors duration-200">
            Browse Campaigns
          </button>
        </div>
      </div>
    </main>
  );
}
