import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, Wallet, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function Finance() {
  const [activeTab, setActiveTab] = useState('buku-kas');

  const kasItems = useLiveQuery(() => db.kas.reverse().toArray());
  const pinjamans = useLiveQuery(() => db.pinjamanGrups.toArray());
  const mutasis = useLiveQuery(() => db.kasbonMutasis.reverse().toArray());
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());

  // Input Manual Kas
  const [jenisKas, setJenisKas] = useState('masuk');
  const [nominalKas, setNominalKas] = useState('');
  const [keteranganKas, setKeteranganKas] = useState('');
  const [tglKas, setTglKas] = useState('');

  // Input Manual Pinjaman
  const [grupId, setGrupId] = useState('');
  const [nominalPinjam, setNominalPinjam] = useState('');
  const [keteranganPinjam, setKeteranganPinjam] = useState('');
  const [tglPinjam, setTglPinjam] = useState('');

  const totalSaldoKas = kasItems?.reduce((acc, curr) => {
    return curr.jenis === 'masuk' ? acc + curr.nominal : acc - curr.nominal;
  }, 0) || 0;

  // Edit Kas State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editKasId, setEditKasId] = useState<number | null>(null);
  const [editJenis, setEditJenis] = useState('');
  const [editNominal, setEditNominal] = useState('');
  const [editKet, setEditKet] = useState('');
  const [editTgl, setEditTgl] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteKas = async (k: any) => {
    if (k.slip_pembayaran_id || k.invoice_id) {
      toast.error('Tidak bisa dihapus: Transaksi ini dibuat otomatis oleh sistem (Invoice/Slip)');
      return;
    }
    if (confirm('Yakin ingin menghapus catatan Kas ini?')) {
      await db.kas.delete(k.id);
      toast.success('Transaksi kas dihapus');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditModal = (k: any) => {
    if (k.slip_pembayaran_id || k.invoice_id) {
      toast.error('Tidak bisa diedit: Transaksi ini dibuat otomatis oleh sistem (Invoice/Slip)');
      return;
    }
    setEditKasId(k.id);
    setEditJenis(k.jenis);
    setEditNominal(k.nominal.toString());
    setEditKet(k.keterangan);
    setEditTgl(format(new Date(k.tanggal), 'yyyy-MM-dd'));
    setEditModalOpen(true);
  };

  const handleUpdateKas = async () => {
    if (!editKasId || !editNominal || !editKet) return toast.error('Lengkapi semua field');
    await db.kas.update(editKasId, {
      jenis: editJenis as 'masuk' | 'keluar',
      nominal: Number(editNominal),
      keterangan: editKet,
      tanggal: new Date(editTgl)
    });
    toast.success('Catatan kas diperbarui');
    setEditModalOpen(false);
  };

  const handleSimpanKasManual = async () => {
    if (!nominalKas || !keteranganKas || !tglKas) return toast.error('Isi semua field');
    await db.kas.add({
      jenis: jenisKas as 'masuk' | 'keluar',
      nominal: Number(nominalKas),
      keterangan: keteranganKas,
      tanggal: new Date(tglKas),
    });
    toast.success('Data kas tersimpan');
    setNominalKas('');
    setKeteranganKas('');
  };

  const handleSimpanPinjaman = async () => {
    if (!grupId || !nominalPinjam || !keteranganPinjam || !tglPinjam) return toast.error('Isi semua field');
    
    // 1. Catat mutasi pinjaman
    await db.kasbonMutasis.add({
      grup_mobil_id: Number(grupId),
      slip_pembayaran_id: 0,
      jenis: 'penambahan',
      nominal: Number(nominalPinjam),
      keterangan: keteranganPinjam,
      tanggal: new Date(tglPinjam)
    });

    // 2. Update Pinjaman Grup
    const p = await db.pinjamanGrups.where('grup_mobil_id').equals(Number(grupId)).first();
    if (p) {
      await db.pinjamanGrups.update(p.id!, {
        total_pinjaman: p.total_pinjaman + Number(nominalPinjam),
        sisa_kasbon: p.sisa_kasbon + Number(nominalPinjam)
      });
    } else {
      await db.pinjamanGrups.add({
        grup_mobil_id: Number(grupId),
        total_pinjaman: Number(nominalPinjam),
        total_potongan: 0,
        sisa_kasbon: Number(nominalPinjam)
      });
    }

    // 3. Potong dari Buku Kas
    await db.kas.add({
      jenis: 'keluar',
      nominal: Number(nominalPinjam),
      keterangan: `Kasbon: ${keteranganPinjam} (Grup: ${grupMobils?.find(g=>g.id===Number(grupId))?.nama_grup})`,
      tanggal: new Date(tglPinjam)
    });

    toast.success('Pinjaman berhasil ditambahkan dan Kas dipotong');
    setNominalPinjam('');
    setKeteranganPinjam('');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Keuangan & Kas</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-primary-foreground/80 font-medium">Saldo Kas Perusahaan</p>
              <h2 className="text-3xl font-bold mt-1">Rp {totalSaldoKas.toLocaleString('id-ID')}</h2>
            </div>
            <Wallet className="w-10 h-10 opacity-80" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="buku-kas">Buku Kas</TabsTrigger>
          <TabsTrigger value="pinjaman">Kasbon Vendor</TabsTrigger>
        </TabsList>

        <TabsContent value="buku-kas">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader><CardTitle>Riwayat Transaksi Kas</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted border-b">
                        <tr>
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Keterangan</th>
                          <th className="p-3 text-right">Masuk</th>
                          <th className="p-3 text-right">Keluar</th>
                          <th className="p-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kasItems?.map(k => (
                          <tr key={k.id} className="border-b">
                            <td className="p-3 whitespace-nowrap">{format(new Date(k.tanggal), 'dd/MM/yyyy')}</td>
                            <td className="p-3">{k.keterangan}</td>
                            <td className="p-3 text-right text-green-600 font-medium">
                              {k.jenis === 'masuk' ? `+ ${k.nominal.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="p-3 text-right text-red-600 font-medium">
                              {k.jenis === 'keluar' ? `- ${k.nominal.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="p-3 flex justify-center gap-2">
                              {(!k.slip_pembayaran_id && !k.invoice_id) ? (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => openEditModal(k)}>
                                    <Edit className="w-4 h-4 text-orange-600" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleDeleteKas(k)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Otomatis</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card>
                <CardHeader><CardTitle>Input Kas Manual</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Jenis</Label>
                    <Select value={jenisKas} onValueChange={setJenisKas}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masuk">Kas Masuk</SelectItem>
                        <SelectItem value="keluar">Kas Keluar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input type="date" value={tglKas} onChange={e => setTglKas(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nominal</Label>
                    <Input type="number" value={nominalKas} onChange={e => setNominalKas(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Keterangan</Label>
                    <Input value={keteranganKas} onChange={e => setKeteranganKas(e.target.value)} />
                  </div>
                  <Button onClick={handleSimpanKasManual} className="w-full">Simpan Transaksi</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pinjaman">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Rekap Sisa Kasbon Vendor</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="p-3">Grup Truk</th>
                        <th className="p-3">Total Pinjaman</th>
                        <th className="p-3">Total Terbayar</th>
                        <th className="p-3 font-bold">Sisa Hutang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pinjamans?.map(p => (
                        <tr key={p.id} className="border-b">
                          <td className="p-3">{grupMobils?.find(g => g.id === p.grup_mobil_id)?.nama_grup}</td>
                          <td className="p-3">{p.total_pinjaman.toLocaleString('id-ID')}</td>
                          <td className="p-3">{p.total_potongan.toLocaleString('id-ID')}</td>
                          <td className="p-3 font-bold text-destructive">Rp {p.sisa_kasbon.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Riwayat Mutasi Kasbon</CardTitle></CardHeader>
                <CardContent>
                   <table className="w-full text-sm text-left">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Grup</th>
                        <th className="p-3">Keterangan</th>
                        <th className="p-3">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutasis?.map(m => (
                        <tr key={m.id} className="border-b">
                          <td className="p-3 whitespace-nowrap">{format(new Date(m.tanggal), 'dd/MM/yyyy')}</td>
                          <td className="p-3">{grupMobils?.find(g => g.id === m.grup_mobil_id)?.nama_grup}</td>
                          <td className="p-3">
                            {m.jenis === 'penambahan' ? <ArrowUpRight className="w-4 h-4 inline text-destructive mr-1"/> : <ArrowDownRight className="w-4 h-4 inline text-success mr-1"/>}
                            {m.keterangan}
                          </td>
                          <td className={m.jenis === 'penambahan' ? 'p-3 text-destructive font-medium' : 'p-3 text-green-600 font-medium'}>
                            {m.nominal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card>
                <CardHeader><CardTitle>Berikan Kasbon Baru</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Grup Vendor</Label>
                    <Select value={grupId} onValueChange={setGrupId}>
                      <SelectTrigger><SelectValue placeholder="Pilih Vendor"/></SelectTrigger>
                      <SelectContent>
                        {grupMobils?.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.nama_grup}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input type="date" value={tglPinjam} onChange={e => setTglPinjam(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nominal (Rp)</Label>
                    <Input type="number" value={nominalPinjam} onChange={e => setNominalPinjam(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Keterangan</Label>
                    <Input value={keteranganPinjam} onChange={e => setKeteranganPinjam(e.target.value)} placeholder="Bon Ban, Solar, dll" />
                  </div>
                  <Button onClick={handleSimpanPinjaman} variant="destructive" className="w-full">Berikan Pinjaman</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Kas Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Catatan Kas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Jenis</Label>
              <Select value={editJenis} onValueChange={setEditJenis}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masuk">Kas Masuk</SelectItem>
                  <SelectItem value="keluar">Kas Keluar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={editTgl} onChange={e => setEditTgl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nominal</Label>
              <Input type="number" value={editNominal} onChange={e => setEditNominal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input value={editKet} onChange={e => setEditKet(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateKas}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
