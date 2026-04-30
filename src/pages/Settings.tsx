import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import { Download, UploadCloud, AlertTriangle, Save, Moon, Sun, Monitor, Type } from 'lucide-react';

import { User, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '@/lib/image-utils';

export default function Settings() {
  const settings = useLiveQuery(() => db.storeSettings.limit(1).first());
  
  const [file, setFile] = useState<File | null>(null);

  // Profile State
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Display State
  const [theme, setTheme] = useState(localStorage.getItem('logistik_theme') || 'auto');
  const [textSize, setTextSize] = useState(localStorage.getItem('logistik_text_size') || 'normal');

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserName(settings.userName || '');
      setCompanyName(settings.companyName || 'LogistikPro PWA');
      setUserAvatar(settings.userAvatar || null);
    }
  }, [settings]);

  const handleThemeChange = (val: string) => {
    setTheme(val);
    localStorage.setItem('logistik_theme', val);
    if (val === 'dark' || (val === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleTextSizeChange = (val: string) => {
    setTextSize(val);
    localStorage.setItem('logistik_text_size', val);
    if (val === 'small') document.documentElement.style.fontSize = '14px';
    else if (val === 'large') document.documentElement.style.fontSize = '18px';
    else document.documentElement.style.fontSize = '16px';
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        const compressedBase64 = await compressImage(f);
        setUserAvatar(compressedBase64);
      } catch {
        toast.error('Gagal memproses gambar');
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!userName.trim()) return toast.error('Nama pengguna tidak boleh kosong');
    try {
      if (settings?.id) {
        await db.storeSettings.update(settings.id, {
          userName: userName.trim(),
          companyName: companyName.trim() || 'LogistikPro PWA',
          userAvatar: userAvatar || undefined
        });
        toast.success('Profil berhasil diperbarui');
      }
    } catch {
      toast.error('Gagal menyimpan profil');
    }
  };

  const handleExportJSON = async () => {
    try {
      const data: Record<string, unknown[]> = {};
      for (const table of db.tables) {
        data[table.name] = await table.toArray();
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `LogistikPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Backup berhasil diunduh');
    } catch {
      toast.error('Gagal melakukan backup');
    }
  };

  const handleImportJSON = async () => {
    if (!file) return toast.error('Pilih file backup (JSON) terlebih dahulu');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!confirm('Peringatan: Import akan MENIMPA semua data yang ada saat ini. Anda yakin?')) return;

      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          if (data[table.name]) {
            await table.clear();
            await table.bulkAdd(data[table.name]);
          }
        }
      });
      
      toast.success('Restore data berhasil! Muat ulang halaman.');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Gagal melakukan restore. Pastikan format file benar.');
    }
  };

  const handleClearData = async () => {
    if (prompt('Ketik "HAPUS" untuk menghapus seluruh data secara permanen. PERINGATAN: Tindakan ini tidak bisa dibatalkan!') === 'HAPUS') {
      await Promise.all(db.tables.map(table => table.clear()));
      toast.success('Seluruh data berhasil dihapus');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Pengaturan Sistem</h1>

      {/* Profil Pengguna */}
      <Card>
        <CardHeader>
          <CardTitle>Profil Pengguna</CardTitle>
          <CardDescription>Informasi ini akan ditampilkan di navigasi dan laporan cetak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-muted border-4 border-background shadow-sm flex items-center justify-center overflow-hidden">
                {userAvatar ? (
                  <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full cursor-pointer shadow-md hover:bg-primary/90 transition">
                <ImageIcon className="w-4 h-4" />
              </Label>
              <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            <div className="flex-1 w-full space-y-4">
              <div className="space-y-2">
                <Label>Nama Pengguna</Label>
                <Input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Nama Anda" />
              </div>
              <div className="space-y-2">
                <Label>Nama Perusahaan / Tim</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Misal: PT Logistik Sukses" />
              </div>
              <Button onClick={handleSaveProfile} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" /> Simpan Profil
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tampilan & Aksesibilitas */}
      <Card>
        <CardHeader>
          <CardTitle>Tampilan & Aksesibilitas</CardTitle>
          <CardDescription>Sesuaikan tampilan aplikasi agar lebih nyaman untuk mata Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2"><Monitor className="w-4 h-4"/> Tema Warna</Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="w-4 h-4"/> Terang</div></SelectItem>
                  <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="w-4 h-4"/> Gelap</div></SelectItem>
                  <SelectItem value="auto"><div className="flex items-center gap-2"><Monitor className="w-4 h-4"/> Otomatis (Sistem)</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label className="flex items-center gap-2"><Type className="w-4 h-4"/> Ukuran Teks</Label>
              <Select value={textSize} onValueChange={handleTextSizeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Ukuran Teks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Kecil (Lebih banyak baris)</SelectItem>
                  <SelectItem value="normal">Normal (Bawaan)</SelectItem>
                  <SelectItem value="large">Besar (Mudah dibaca)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ekspor Data (Backup)</CardTitle>
            <CardDescription>Unduh seluruh basis data ke dalam file JSON untuk dicadangkan (backup) atau dipindahkan ke perangkat lain.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportJSON} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Download Backup JSON
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impor Data (Restore)</CardTitle>
            <CardDescription>Pulihkan data dari file JSON. Perhatian: ini akan menimpa/menghapus data Anda yang sekarang.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept=".json" onChange={e => setFile(e.target.files?.[0] || null)} />
            <Button onClick={handleImportJSON} variant="secondary" className="w-full border">
              <UploadCloud className="w-4 h-4 mr-2" /> Restore dari JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive md:col-span-2">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Zona Bahaya</CardTitle>
            <CardDescription>Tindakan di bawah ini akan menghapus data di perangkat Anda secara permanen.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleClearData} variant="destructive">Reset & Hapus Semua Data</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
