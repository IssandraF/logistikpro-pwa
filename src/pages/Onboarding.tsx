import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { compressImage } from '@/lib/image-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Image as ImageIcon, Briefcase, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('LogistikPro PWA');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Cek apakah sudah pernah onboarding
    const checkStatus = async () => {
      const setting = await db.storeSettings.limit(1).first();
      if (setting && setting.userName) {
        navigate('/app');
      } else if (setting && setting.companyName) {
        setCompanyName(setting.companyName);
      }
    };
    checkStatus();
  }, [navigate]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setUserAvatar(compressedBase64);
      } catch {
        toast.error('Gagal memproses gambar');
      }
    }
  };

  const handleSave = async () => {
    if (!userName.trim()) {
      toast.error('Nama pengguna wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const setting = await db.storeSettings.limit(1).first();
      if (setting && setting.id) {
        await db.storeSettings.update(setting.id, {
          userName: userName.trim(),
          userAvatar: userAvatar || undefined,
          companyName: companyName.trim() || 'LogistikPro PWA'
        });
      } else {
        await db.storeSettings.add({
          userName: userName.trim(),
          userAvatar: userAvatar || undefined,
          companyName: companyName.trim() || 'LogistikPro PWA'
        });
      }
      toast.success('Profil berhasil disimpan! Selamat datang.');
      // Force reload to make AppLayout fetch the latest settings
      window.location.href = '/app';
    } catch {
      toast.error('Gagal menyimpan profil');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <User className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Selamat Datang di LogistikPro</CardTitle>
          <CardDescription>Sebelum memulai, mari atur profil Anda agar laporan dan tampilan aplikasi lebih personal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-muted border-4 border-background shadow-md flex items-center justify-center overflow-hidden">
                {userAvatar ? (
                  <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full cursor-pointer shadow-lg hover:bg-primary/90 transition">
                <ImageIcon className="w-4 h-4" />
              </Label>
              <Input 
                id="avatar-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoUpload} 
              />
            </div>
            <p className="text-xs text-muted-foreground">Foto Profil (Opsional)</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Anda <span className="text-destructive">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Misal: Budi Santoso" 
                  className="pl-10" 
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nama Perusahaan / Tim (Opsional)</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Misal: PT Logistik Sukses" 
                  className="pl-10"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={isLoading || !userName.trim()} 
            className="w-full h-12 text-lg"
          >
            Mulai Gunakan Aplikasi <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
