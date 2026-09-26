import Hero from '@/components/Hero';
import Navbar from '@/components/Navbar';

export default function App() {
  return (
    <div id="top" className="min-h-screen bg-[#080A19] text-white antialiased">
      <Navbar />
      <main>
        <Hero />
      </main>
    </div>
  );
}
