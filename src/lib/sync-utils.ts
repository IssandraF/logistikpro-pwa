import { db } from './db';

// --- UTILITIES ---

const safeTrimLower = (val: string | undefined | null) => {
  if (!val) return '';
  return String(val).trim().toLowerCase();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const findOrCreateByName = async (table: any, nameField: string, nameValue: string, extraFields = {}) => {
  if (!nameValue || nameValue.trim() === '') return null;
  const searchVal = safeTrimLower(nameValue);
  
  const allRecords = await table.toArray();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = allRecords.find((r: any) => safeTrimLower(r[nameField]) === searchVal);
  
  if (existing) return existing.id;
  
  const newId = await table.add({
    [nameField]: nameValue.trim(),
    createdAt: new Date(),
    isDeleted: 0,
    ...extraFields
  });
  return newId;
};

export const findOrCreateProyekLokasi = async (proyekName: string, lokasiName: string) => {
  if (!proyekName || !lokasiName) return null;
  const pId = await findOrCreateByName(db.proyeks, 'nama_proyek', proyekName);
  const lId = await findOrCreateByName(db.lokasiProyeks, 'nama_lokasi', lokasiName);
  
  const allPL = await db.proyekLokasis.toArray();
  const existing = allPL.find(pl => pl.proyek_id === pId && pl.lokasi_proyek_id === lId);
  
  if (existing) return existing.id;
  
  const newId = await db.proyekLokasis.add({
    proyek_id: pId!,
    lokasi_proyek_id: lId!,
    createdAt: new Date(),
    isDeleted: 0
  });
  return newId;
};

// --- TRIPS ---

export const exportSmartTrips = async (tripIds?: number[]) => {
  let trips;
  if (tripIds && tripIds.length > 0) {
    trips = await db.trips.where('id').anyOf(tripIds).toArray();
  } else {
    trips = await db.trips.toArray();
  }
  
  // Cache masters to speed up mapping
  const grupMobils = await db.grupMobils.toArray();
  const kuaris = await db.lokasiKuaris.toArray();
  const jasa = await db.jenisJasas.toArray();
  const proyekLokasis = await db.proyekLokasis.toArray();
  const proyeks = await db.proyeks.toArray();
  const lokasiProyeks = await db.lokasiProyeks.toArray();
  
  const invoices = await db.invoices.toArray();
  const slips = await db.slipPembayarans.toArray();

  const exportedData = trips.map(t => {
    const grup = grupMobils.find(g => g.id === t.grup_mobil_id);
    const kuari = kuaris.find(k => k.id === t.lokasi_kuari_id);
    const js = jasa.find(j => j.id === t.jenis_jasa_id);
    
    const pl = proyekLokasis.find(p => p.id === t.proyek_lokasi_id);
    const proyek = pl ? proyeks.find(p => p.id === pl.proyek_id) : null;
    const lokasi = pl ? lokasiProyeks.find(l => l.id === pl.lokasi_proyek_id) : null;
    
    const inv = invoices.find(i => i.id === t.invoice_id);
    const slip = slips.find(s => s.id === t.slip_pembayaran_id);

    return {
      plat_nomor: t.plat_nomor,
      volume: t.volume,
      harga_trip: t.harga_trip,
      total_harga: t.total_harga,
      tanggal_muat: t.tanggal_muat,
      tanggal_bongkar: t.tanggal_bongkar,
      bukti_do: t.bukti_do, // optional
      harga_bayar: t.harga_bayar,
      potongan_trip: t.potongan_trip,
      
      // Relational Names
      rel_grup_mobil: grup?.nama_grup || '',
      rel_lokasi_kuari: kuari?.nama_lokasi || '',
      rel_jenis_jasa: js?.nama_js || '',
      rel_proyek: proyek?.nama_proyek || '',
      rel_lokasi_bongkar: lokasi?.nama_lokasi || '',
      
      // Link to Invoices/Slips (must exist or will be ignored)
      rel_invoice_nomor: inv?.nomor_invoice || '',
      rel_slip_nomor: slip?.nomor_slip || ''
    };
  });

  downloadJSON(exportedData, 'LogistikPro_Trips_SmartExport');
};

export const importSmartTrips = async (file: File) => {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Invalid format. Expected an array.");

  let imported = 0;
  let skipped = 0;

  await db.transaction('rw', db.tables, async () => {
    const allInvoices = await db.invoices.toArray();
    const allSlips = await db.slipPembayarans.toArray();
    const allTrips = await db.trips.toArray();

    for (const row of data) {
      // Find natural keys
      const grupId = await findOrCreateByName(db.grupMobils, 'nama_grup', row.rel_grup_mobil);
      const kuariId = await findOrCreateByName(db.lokasiKuaris, 'nama_lokasi', row.rel_lokasi_kuari);
      const jasaId = await findOrCreateByName(db.jenisJasas, 'nama_js', row.rel_jenis_jasa);
      const plId = await findOrCreateProyekLokasi(row.rel_proyek, row.rel_lokasi_bongkar);

      const invId = row.rel_invoice_nomor ? allInvoices.find(i => safeTrimLower(i.nomor_invoice) === safeTrimLower(row.rel_invoice_nomor))?.id : null;
      const slipId = row.rel_slip_nomor ? allSlips.find(s => safeTrimLower(s.nomor_slip) === safeTrimLower(row.rel_slip_nomor))?.id : null;

      // Check for duplication: same plat, same tanggal_bongkar, same volume
      const duplicateTrip = allTrips.find(t => 
        safeTrimLower(t.plat_nomor) === safeTrimLower(row.plat_nomor) &&
        new Date(t.tanggal_bongkar).getTime() === new Date(row.tanggal_bongkar).getTime() &&
        t.volume === row.volume
      );

      if (duplicateTrip) {
        if (duplicateTrip.isDeleted === 1) {
          // Trip was deleted in UI, restore it
          await db.trips.update(duplicateTrip.id!, { 
            isDeleted: 0,
            grup_mobil_id: grupId || 0,
            lokasi_kuari_id: kuariId || 0,
            jenis_jasa_id: jasaId || 0,
            proyek_lokasi_id: plId || 0,
          });
          imported++;
        } else {
          skipped++;
        }
        continue;
      }

      await db.trips.add({
        plat_nomor: row.plat_nomor,
        volume: row.volume,
        harga_trip: row.harga_trip,
        total_harga: row.total_harga,
        tanggal_muat: new Date(row.tanggal_muat),
        tanggal_bongkar: new Date(row.tanggal_bongkar),
        bukti_do: row.bukti_do,
        harga_bayar: row.harga_bayar,
        potongan_trip: row.potongan_trip,
        
        grup_mobil_id: grupId || 0,
        lokasi_kuari_id: kuariId || 0,
        jenis_jasa_id: jasaId || 0,
        proyek_lokasi_id: plId || 0,
        invoice_id: invId || null,
        slip_pembayaran_id: slipId || null,
        
        createdAt: new Date(),
        isDeleted: 0
      });
      imported++;
    }
  });

  return { imported, skipped };
};

// --- INVOICES ---

export const exportSmartInvoices = async () => {
  const invoices = await db.invoices.toArray();
  const proyeks = await db.proyeks.toArray();
  const owners = await db.owners.toArray();

  const exportedData = invoices.map(inv => {
    const proyek = proyeks.find(p => p.id === inv.proyek_id);
    const owner = owners.find(o => o.id === inv.owner_id);

    return {
      nomor_invoice: inv.nomor_invoice,
      tanggal_invoice: inv.tanggal_invoice,
      total_kubikasi: inv.total_kubikasi,
      volume_ditagih: inv.volume_ditagih,
      sisa_volume: inv.sisa_volume,
      sisa_volume_sebelumnya: inv.sisa_volume_sebelumnya,
      harga_per_kubik: inv.harga_per_kubik,
      is_custom_total: inv.is_custom_total,
      total_harga_kotor: inv.total_harga_kotor,
      is_potong_material: inv.is_potong_material,
      total_potongan_material: inv.total_potongan_material,
      total_harga_bersih: inv.total_harga_bersih,
      sisa_invoice_sebelumnya: inv.sisa_invoice_sebelumnya,
      total_keseluruhan: inv.total_keseluruhan,
      kepada_custom: inv.kepada_custom,
      nama_ttd: inv.nama_ttd,
      status: inv.status,
      
      rel_proyek_nama: proyek?.nama_proyek || '',
      rel_owner_nama: owner?.nama || ''
    };
  });

  downloadJSON(exportedData, 'LogistikPro_Invoices_SmartExport');
};

export const importSmartInvoices = async (file: File) => {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Invalid format. Expected an array.");

  let imported = 0;
  let skipped = 0;

  await db.transaction('rw', db.tables, async () => {
    const allInvoices = await db.invoices.toArray();

    for (const row of data) {
      // Check for duplication: same nomor_invoice
      const duplicateInvoice = allInvoices.find(i => safeTrimLower(i.nomor_invoice) === safeTrimLower(row.nomor_invoice));

      if (duplicateInvoice) {
        if (duplicateInvoice.isDeleted === 1) {
          // Invoice was deleted in UI, restore it
          const pId = await findOrCreateByName(db.proyeks, 'nama_proyek', row.rel_proyek_nama);
          const oId = await findOrCreateByName(db.owners, 'nama', row.rel_owner_nama);
          await db.invoices.update(duplicateInvoice.id!, { 
            isDeleted: 0,
            proyek_id: pId || 0,
            owner_id: oId || 0
          });
          imported++;
        } else {
          skipped++;
        }
        continue;
      }

      const proyekId = await findOrCreateByName(db.proyeks, 'nama_proyek', row.rel_proyek_nama);
      const ownerId = await findOrCreateByName(db.owners, 'nama', row.rel_owner_nama);

      await db.invoices.add({
        nomor_invoice: row.nomor_invoice,
        tanggal_invoice: new Date(row.tanggal_invoice),
        proyek_id: proyekId || 0,
        owner_id: ownerId || 0,
        total_kubikasi: row.total_kubikasi,
        volume_ditagih: row.volume_ditagih,
        sisa_volume: row.sisa_volume,
        sisa_volume_sebelumnya: row.sisa_volume_sebelumnya,
        harga_per_kubik: row.harga_per_kubik,
        is_custom_total: row.is_custom_total,
        total_harga_kotor: row.total_harga_kotor,
        is_potong_material: row.is_potong_material,
        total_potongan_material: row.total_potongan_material,
        total_harga_bersih: row.total_harga_bersih,
        sisa_invoice_sebelumnya: row.sisa_invoice_sebelumnya,
        total_keseluruhan: row.total_keseluruhan,
        kepada_custom: row.kepada_custom,
        nama_ttd: row.nama_ttd,
        status: row.status || 'draft',
        createdAt: new Date()
      });
      imported++;
    }
  });

  return { imported, skipped };
};

// --- SYNC TOTALS HELPERS ---

export const syncInvoiceTotals = async (invoiceId: number) => {
  const invTrips = await db.trips.where('invoice_id').equals(invoiceId).filter(t => t.isDeleted === 0).toArray();
  const qPrices = await db.invoiceQuarryPrices.where('invoice_id').equals(invoiceId).toArray();
  
  let vol = 0;
  let kotor = 0;
  const kuariMap: Record<number, number> = {};
  
  invTrips.forEach(t => {
    vol += t.volume;
    kotor += t.total_harga;
    kuariMap[t.lokasi_kuari_id] = (kuariMap[t.lokasi_kuari_id] || 0) + 1;
  });

  let potongan = 0;
  for (const qp of qPrices) {
    const count = kuariMap[qp.lokasi_kuari_id] || 0;
    await db.invoiceQuarryPrices.update(qp.id!, { jumlah_trip: count });
    potongan += count * qp.harga_material_override;
  }

  const bersih = kotor - potongan;

  await db.invoices.update(invoiceId, {
    total_kubikasi: vol,
    total_harga_kotor: kotor,
    total_potongan_material: potongan,
    total_harga_bersih: bersih
  });
};

export const syncSlipTotals = async (slipId: number) => {
  const slip = await db.slipPembayarans.get(slipId);
  if (!slip) return;

  const slipTrips = await db.trips.where('slip_pembayaran_id').equals(slipId).filter(t => t.isDeleted === 0).toArray();

  let totalTripOngkos = 0;
  let totalPotonganMaterial = 0;

  slipTrips.forEach(t => {
    const hargaBayar = t.harga_bayar !== undefined && t.harga_bayar !== null ? t.harga_bayar : t.harga_trip;
    totalTripOngkos += t.volume * hargaBayar;
    totalPotonganMaterial += (t.potongan_trip || 0) * t.volume;
  });

  const totalBersih = totalTripOngkos - totalPotonganMaterial - (slip.potongan_kasbon || 0);

  await db.slipPembayarans.update(slipId, {
    total_trip_ongkos: totalTripOngkos,
    potongan_material: totalPotonganMaterial,
    total_bersih_dibayar: totalBersih
  });

  const kasEntries = await db.kas.where('slip_pembayaran_id').equals(slipId).toArray();
  for (const k of kasEntries) {
    await db.kas.update(k.id!, {
      nominal: totalBersih
    });
  }
};

