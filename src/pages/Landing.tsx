import { Link } from 'react-router-dom';
import { Truck, FileText, Database, ShieldCheck, ArrowRight, Zap, ChevronRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/30">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-xl">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">LogistikPro</span>
          </div>
          <div>
            <Link to="/app">
              <Button className="rounded-full shadow-md font-semibold">
                Masuk ke Sistem <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap className="w-4 h-4" />
            <span>Sistem ERP Logistik Generasi Baru</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-foreground animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
            Manajemen Transportasi <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
              Cepat & Tanpa Batas
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Sistem manajemen trip, tagihan, dan pembayaran vendor berarsitektur Offline-First. 
            Aman, sangat cepat, dan data tersimpan lokal sepenuhnya di perangkat Anda.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
            <Link to="/app">
              <Button size="lg" className="rounded-full px-8 h-14 text-base shadow-xl shadow-primary/25 hover:scale-105 transition-transform">
                Mulai Gunakan Gratis <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Fitur Unggulan</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Dibangun dengan teknologi modern untuk memastikan operasional logistik Anda berjalan tanpa hambatan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Database className="w-6 h-6 text-blue-500" />}
              title="100% Offline-First"
              description="Terus bekerja tanpa koneksi internet. Data disinkronisasi otomatis menggunakan IndexedDB berkinerja tinggi."
              delay="0"
            />
            <FeatureCard 
              icon={<Truck className="w-6 h-6 text-green-500" />}
              title="Manajemen Trip"
              description="Catat muat bongkar, kompresi foto DO otomatis, dan perhitungan tarif yang fleksibel sesuai jarak."
              delay="100"
            />
            <FeatureCard 
              icon={<FileText className="w-6 h-6 text-orange-500" />}
              title="Invoicing Cerdas"
              description="Buat invoice multi-sheet instan dengan fitur potongan material, rekap harian, dan Terbilang Rupiah otomatis."
              delay="200"
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6 text-purple-500" />}
              title="Keamanan Lokal"
              description="Privasi terjamin. Data operasional dan finansial hanya disimpan secara lokal di mesin milik Anda."
              delay="300"
            />
          </div>
        </div>
      </section>

      {/* Workflow Highlight */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Alur Kerja yang Didesain untuk Efisiensi Ekstrem
              </h2>
              <p className="text-lg text-muted-foreground">
                Tinggalkan pencatatan manual yang rentan hilang atau rusak. LogistikPro membawa pembukuan perusahaan transport Anda ke level berikutnya.
              </p>
              
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Pencatatan Real-Time</h4>
                    <p className="text-muted-foreground">Input ritase supir secepat Anda mengetik di kalkulator.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Slip Gaji & Kasbon Vendor</h4>
                    <p className="text-muted-foreground">Kelola hutang vendor dan berikan slip tagihan yang detail dan presisi.</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="lg:w-1/2 w-full relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-blue-500/20 blur-2xl rounded-3xl -z-10" />
              <div className="bg-card border rounded-2xl shadow-2xl p-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <img 
                  src="https://images.unsplash.com/photo-1580674285054-bed31e145f59?q=80&w=2070&auto=format&fit=crop" 
                  alt="Logistics Operation" 
                  className="rounded-xl w-full object-cover aspect-[4/3] grayscale-[30%] group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10" />
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Siap Merampingkan Operasional Anda?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Akses aplikasi langsung dari browser Anda sekarang. Tidak perlu instalasi server atau backend tambahan.
          </p>
          <Link to="/app">
            <Button size="lg" className="rounded-full px-10 h-16 text-lg font-bold shadow-2xl hover:scale-105 transition-all">
              Buka Dashboard <ArrowRight className="w-6 h-6 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-card">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80">
            <Truck className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">LogistikPro</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LogistikPro ERP. Hak Cipta Dilindungi.
          </p>
          <div className="text-sm text-muted-foreground">
            Dibangun dengan <span className="text-red-500">♥</span> & Offline-First Technology
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sub-component for features
function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: string }) {
  return (
    <div 
      className={`bg-card p-6 rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-8 delay-[${delay}ms]`}
    >
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
