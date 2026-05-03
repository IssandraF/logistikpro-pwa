import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState('grup-mobil');

  // Grup Mobil
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const [namaGrup, setNamaGrup] = useState('');
  const [ownerNama, setOwnerNama] = useState('');
  const [editingGrupId, setEditingGrupId] = useState<number | null>(null);

  const saveGrupMobil = async () => {
    if (!namaGrup) return toast.error('Nama grup wajib diisi');
    if (editingGrupId) {
      await db.grupMobils.update(editingGrupId, { nama_grup: namaGrup, owner_nama: ownerNama });
      toast.success('Grup Mobil berhasil diperbarui');
    } else {
      await db.grupMobils.add({ nama_grup: namaGrup, owner_nama: ownerNama, createdAt: new Date(), isDeleted: 0 });
      toast.success('Grup Mobil berhasil ditambahkan');
    }
    cancelEditGrup();
  };

  const editGrup = (g: any) => {
    setEditingGrupId(g.id);
    setNamaGrup(g.nama_grup);
    setOwnerNama(g.owner_nama || '');
  };

  const cancelEditGrup = () => {
    setEditingGrupId(null);
    setNamaGrup('');
    setOwnerNama('');
  };

  const deleteGrupMobil = async (id: number) => {
    if (!confirm('Hapus Grup Mobil ini?')) return;
    await db.grupMobils.update(id, { isDeleted: 1 });
    toast.success('Dihapus');
  };

  // Proyek
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const [namaProyek, setNamaProyek] = useState('');
  const [editingProyekId, setEditingProyekId] = useState<number | null>(null);

  const saveProyek = async () => {
    if (!namaProyek) return;
    if (editingProyekId) {
      await db.proyeks.update(editingProyekId, { nama_proyek: namaProyek });
      toast.success('Proyek berhasil diperbarui');
    } else {
      await db.proyeks.add({ nama_proyek: namaProyek, createdAt: new Date(), isDeleted: 0 });
      toast.success('Proyek berhasil ditambahkan');
    }
    cancelEditProyek();
  };

  const editProyek = (p: any) => {
    setEditingProyekId(p.id);
    setNamaProyek(p.nama_proyek);
  };

  const cancelEditProyek = () => {
    setEditingProyekId(null);
    setNamaProyek('');
  };

  // Lokasi Kuari
  const lokasiKuaris = useLiveQuery(() => db.lokasiKuaris.where('isDeleted').equals(0).toArray());
  const [namaKuari, setNamaKuari] = useState('');
  const [editingKuariId, setEditingKuariId] = useState<number | null>(null);

  const saveKuari = async () => {
    if (!namaKuari) return;
    if (editingKuariId) {
      await db.lokasiKuaris.update(editingKuariId, { nama_lokasi: namaKuari });
      toast.success('Lokasi Kuari berhasil diperbarui');
    } else {
      await db.lokasiKuaris.add({ nama_lokasi: namaKuari, createdAt: new Date(), isDeleted: 0 });
      toast.success('Lokasi Kuari berhasil ditambahkan');
    }
    cancelEditKuari();
  };

  const editKuari = (k: any) => {
    setEditingKuariId(k.id);
    setNamaKuari(k.nama_lokasi);
  };

  const cancelEditKuari = () => {
    setEditingKuariId(null);
    setNamaKuari('');
  };

  // Jenis Jasa
  const jenisJasas = useLiveQuery(() => db.jenisJasas.where('isDeleted').equals(0).toArray());
  const [namaJs, setNamaJs] = useState('');
  const [editingJsId, setEditingJsId] = useState<number | null>(null);

  const saveJs = async () => {
    if (!namaJs) return;
    if (editingJsId) {
      await db.jenisJasas.update(editingJsId, { nama_js: namaJs });
      toast.success('Jenis Jasa berhasil diperbarui');
    } else {
      await db.jenisJasas.add({ nama_js: namaJs, createdAt: new Date(), isDeleted: 0 });
      toast.success('Jenis Jasa berhasil ditambahkan');
    }
    cancelEditJs();
  };

  const editJs = (j: any) => {
    setEditingJsId(j.id);
    setNamaJs(j.nama_js);
  };

  const cancelEditJs = () => {
    setEditingJsId(null);
    setNamaJs('');
  };

  // Rute Tujuan (Proyek Lokasi Pivot)
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.where('isDeleted').equals(0).toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.where('isDeleted').equals(0).toArray());
  const [selectedProyekId, setSelectedProyekId] = useState('');
  const [namaLokasiRute, setNamaLokasiRute] = useState('');
  const [editingRuteId, setEditingRuteId] = useState<{pivotId: number, lokasiId: number} | null>(null);

  const saveRuteTujuan = async () => {
    if (!selectedProyekId || !namaLokasiRute) return toast.error('Pilih Proyek dan isi Nama Lokasi Tujuan');
    
    if (editingRuteId) {
      await db.lokasiProyeks.update(editingRuteId.lokasiId, {
        nama_lokasi: namaLokasiRute
      });
      await db.proyekLokasis.update(editingRuteId.pivotId, {
        proyek_id: Number(selectedProyekId)
      });
      toast.success('Rute Tujuan berhasil diperbarui');
    } else {
      const lokasiId = await db.lokasiProyeks.add({
        nama_lokasi: namaLokasiRute,
        createdAt: new Date(),
        isDeleted: 0
      });

      await db.proyekLokasis.add({
        proyek_id: Number(selectedProyekId),
        lokasi_proyek_id: Number(lokasiId),
        jarak: 0,
        harga: 0,
        createdAt: new Date(),
        isDeleted: 0
      });

      toast.success('Rute Tujuan berhasil ditambahkan');
    }
    cancelEditRute();
  };

  const editRute = (pl: any, lName: string) => {
    setEditingRuteId({ pivotId: pl.id, lokasiId: pl.lokasi_proyek_id });
    setSelectedProyekId(pl.proyek_id.toString());
    setNamaLokasiRute(lName || '');
  };

  const cancelEditRute = () => {
    setEditingRuteId(null);
    setNamaLokasiRute('');
    setSelectedProyekId('');
  };

  const deleteRute = async (pivotId: number, lokasiId: number) => {
    if (!confirm('Hapus Rute Tujuan ini?')) return;
    await db.proyekLokasis.update(pivotId, { isDeleted: 1 });
    await db.lokasiProyeks.update(lokasiId, { isDeleted: 1 });
    toast.success('Rute Dihapus');
  };

  // Perusahaan (Owner)
  const owners = useLiveQuery(() => db.owners.where('isDeleted').equals(0).toArray());
  const [namaOwner, setNamaOwner] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [bankAccName, setBankAccName] = useState('');
  const [editingOwnerId, setEditingOwnerId] = useState<number | null>(null);

  const saveOwner = async () => {
    if (!namaOwner || !bankName || !bankAcc || !bankAccName) return toast.error('Isi semua field perusahaan/owner');
    
    if (editingOwnerId) {
      await db.owners.update(editingOwnerId, {
        nama: namaOwner,
        nama_bank: bankName,
        no_rek: bankAcc,
        atas_nama: bankAccName,
      });
      toast.success('Perusahaan berhasil diperbarui');
    } else {
      await db.owners.add({
        nama: namaOwner,
        nama_bank: bankName,
        no_rek: bankAcc,
        atas_nama: bankAccName,
        createdAt: new Date(),
        isDeleted: 0
      });
      toast.success('Perusahaan berhasil ditambahkan');
    }
    cancelEditOwner();
  };

  const editOwner = (o: any) => {
    setEditingOwnerId(o.id);
    setNamaOwner(o.nama);
    setBankName(o.nama_bank);
    setBankAcc(o.no_rek);
    setBankAccName(o.atas_nama);
  };

  const cancelEditOwner = () => {
    setEditingOwnerId(null);
    setNamaOwner(''); setBankName(''); setBankAcc(''); setBankAccName('');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Data Master</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto gap-2">
          <TabsTrigger value="grup-mobil">Grup Mobil</TabsTrigger>
          <TabsTrigger value="perusahaan">Perusahaan (Pengirim)</TabsTrigger>
          <TabsTrigger value="proyek">Proyek</TabsTrigger>
          <TabsTrigger value="rute-proyek">Rute Tujuan</TabsTrigger>
          <TabsTrigger value="lokasi-kuari">Lokasi Kuari</TabsTrigger>
          <TabsTrigger value="jenis-jasa">Jenis Jasa</TabsTrigger>
        </TabsList>

        <TabsContent value="perusahaan">
          <Card>
            <CardHeader><CardTitle>Perusahaan / Pengirim Invoice</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>Nama Perusahaan / Pemilik</Label>
                  <Input value={namaOwner} onChange={e => setNamaOwner(e.target.value)} placeholder="Misal: PT Logistik / Bapak Budi" />
                </div>
                <div className="space-y-2">
                  <Label>Nama Bank</Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="BCA" />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Rekening</Label>
                  <Input value={bankAcc} onChange={e => setBankAcc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Atas Nama</Label>
                  <Input value={bankAccName} onChange={e => setBankAccName(e.target.value)} />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button onClick={saveOwner} className="flex-1">
                    {editingOwnerId ? <><Save className="w-4 h-4 mr-2"/> Simpan Perubahan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah Perusahaan</>}
                  </Button>
                  {editingOwnerId && <Button variant="outline" onClick={cancelEditOwner}>Batal</Button>}
                </div>
              </div>
              <ul className="space-y-2">
                {owners?.map(o => (
                  <li key={o.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-bold">{o.nama}</p>
                      <p className="text-sm text-muted-foreground">{o.nama_bank} - {o.no_rek} a/n {o.atas_nama}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => editOwner(o)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm('Hapus Perusahaan ini?')) db.owners.update(o.id!, { isDeleted: 1 }) }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grup-mobil">
          <Card>
            <CardHeader>
              <CardTitle>Grup Mobil / Vendor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Grup/Truk</Label>
                  <Input value={namaGrup} onChange={e => setNamaGrup(e.target.value)} placeholder="Contoh: Budi Trans" />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Nama Owner (Opsional)</Label>
                  <Input value={ownerNama} onChange={e => setOwnerNama(e.target.value)} placeholder="Contoh: Pak Budi" />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={saveGrupMobil}>
                    {editingGrupId ? <><Save className="w-4 h-4 mr-2"/> Simpan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah</>}
                  </Button>
                  {editingGrupId && <Button variant="outline" size="icon" onClick={cancelEditGrup}><X className="w-4 h-4"/></Button>}
                </div>
              </div>

              <div className="border rounded-md">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3">Nama Grup</th>
                      <th className="p-3">Owner</th>
                      <th className="p-3 w-32">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupMobils?.map(g => (
                      <tr key={g.id} className="border-t">
                        <td className="p-3">{g.nama_grup}</td>
                        <td className="p-3">{g.owner_nama || '-'}</td>
                        <td className="p-3 flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => editGrup(g)}>
                            <Edit className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteGrupMobil(g.id!)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {grupMobils?.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Belum ada data</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proyek">
          <Card>
            <CardHeader><CardTitle>Proyek</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Proyek</Label>
                  <Input value={namaProyek} onChange={e => setNamaProyek(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={saveProyek}>
                    {editingProyekId ? <><Save className="w-4 h-4 mr-2"/> Simpan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah</>}
                  </Button>
                  {editingProyekId && <Button variant="outline" size="icon" onClick={cancelEditProyek}><X className="w-4 h-4"/></Button>}
                </div>
              </div>
              <ul className="space-y-2">
                {proyeks?.map(p => (
                  <li key={p.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span>{p.nama_proyek}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => editProyek(p)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm('Hapus Proyek ini?')) db.proyeks.update(p.id!, { isDeleted: 1 }) }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rute-proyek">
          <Card>
            <CardHeader><CardTitle>Rute Tujuan Proyek</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Proyek Induk</Label>
                  <Select value={selectedProyekId} onValueChange={setSelectedProyekId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Proyek" /></SelectTrigger>
                    <SelectContent>
                      {proyeks?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.nama_proyek}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Nama Tujuan / Rute</Label>
                  <Input value={namaLokasiRute} onChange={e => setNamaLokasiRute(e.target.value)} placeholder="Misal: KM 15 / Stockpile B" />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={saveRuteTujuan}>
                    {editingRuteId ? <><Save className="w-4 h-4 mr-2"/> Simpan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah</>}
                  </Button>
                  {editingRuteId && <Button variant="outline" size="icon" onClick={cancelEditRute}><X className="w-4 h-4"/></Button>}
                </div>
              </div>
              <ul className="space-y-2">
                {proyekLokasis?.map(pl => {
                  const pName = proyeks?.find(p => p.id === pl.proyek_id)?.nama_proyek;
                  const lName = lokasiProyeks?.find(l => l.id === pl.lokasi_proyek_id)?.nama_lokasi;
                  return (
                    <li key={pl.id} className="flex items-center justify-between p-3 border rounded-md">
                      <span><strong>{pName}</strong> - {lName}</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => editRute(pl, lName || '')}><Edit className="w-4 h-4 text-blue-500" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteRute(pl.id!, pl.lokasi_proyek_id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
                {proyekLokasis?.length === 0 && <p className="text-muted-foreground text-center p-4 border rounded">Belum ada rute</p>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lokasi-kuari">
          <Card>
            <CardHeader><CardTitle>Lokasi Kuari</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Kuari</Label>
                  <Input value={namaKuari} onChange={e => setNamaKuari(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={saveKuari}>
                    {editingKuariId ? <><Save className="w-4 h-4 mr-2"/> Simpan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah</>}
                  </Button>
                  {editingKuariId && <Button variant="outline" size="icon" onClick={cancelEditKuari}><X className="w-4 h-4"/></Button>}
                </div>
              </div>
              <ul className="space-y-2">
                {lokasiKuaris?.map(k => (
                  <li key={k.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span>{k.nama_lokasi}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => editKuari(k)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm('Hapus Lokasi Kuari?')) db.lokasiKuaris.update(k.id!, { isDeleted: 1 }) }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jenis-jasa">
          <Card>
            <CardHeader><CardTitle>Jenis Jasa</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Jasa</Label>
                  <Input value={namaJs} onChange={e => setNamaJs(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={saveJs}>
                    {editingJsId ? <><Save className="w-4 h-4 mr-2"/> Simpan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah</>}
                  </Button>
                  {editingJsId && <Button variant="outline" size="icon" onClick={cancelEditJs}><X className="w-4 h-4"/></Button>}
                </div>
              </div>
              <ul className="space-y-2">
                {jenisJasas?.map(j => (
                  <li key={j.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span>{j.nama_js}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => editJs(j)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm('Hapus Jenis Jasa?')) db.jenisJasas.update(j.id!, { isDeleted: 1 }) }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
