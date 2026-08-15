import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatTerbilang } from './print-utils';
import type { Invoice, Trip, Owner, Proyek, ProyekLokasi, LokasiProyek, LokasiKuari } from './db';

export async function exportInvoiceExcel(
  invoice: Invoice,
  trips: Trip[],
  owner: Owner,
  proyek: Proyek,
  proyekLokasis: ProyekLokasi[],
  lokasiProyeks: LokasiProyek[],
  lokasiKuaris: LokasiKuari[]
) {
  const wb = XLSX.utils.book_new();

  // Helper functions
  const getLokasiName = (plId: number) => {
    const pl = proyekLokasis.find(x => x.id === plId);
    if (!pl) return '-';
    const loc = lokasiProyeks.find(x => x.id === pl.lokasi_proyek_id);
    return loc ? loc.nama_lokasi : '-';
  };

  const getKuariName = (kId: number) => {
    const k = lokasiKuaris.find(x => x.id === kId);
    return k ? k.nama_lokasi : '-';
  };

  // ==========================================
  // SHEET 1: INVOICE MAIN
  // ==========================================
  const mainAoa: (string | number)[][] = [];
  
  // Title
  mainAoa.push(['INVOICE']);
  mainAoa.push([]);
  
  // Headers Kepada dll
  const kepada = invoice.kepada_custom ? invoice.kepada_custom.toUpperCase() : proyek.nama_proyek.toUpperCase();
  mainAoa.push(['Kepada', `: ${kepada}`, '', '', 'Nomor', `: ${invoice.nomor_invoice}`]);
  mainAoa.push(['Pemasok', `: ${owner.nama.toUpperCase()}`, '', '', 'Tanggal', `: ${format(new Date(invoice.tanggal_invoice), 'dd MMMM yyyy', { locale: id })}`]);
  mainAoa.push([]);
  mainAoa.push(['Mohon dibayarkan sesuai dengan rincian berikut:']);
  
  // Table Header
  mainAoa.push(['NO', 'TGL MUAT & BONGKAR', 'STA / LOKASI', 'MATERIAL', 'RITASE', 'VOL (M3)', 'HARGA (Rp)', 'NILAI PO (Rp)']);

  // Summary Grouping
  const summaryTrips = [...trips].sort((a, b) => new Date(a.tanggal_bongkar).getTime() - new Date(b.tanggal_bongkar).getTime());
  const groupedSummary = summaryTrips.reduce((acc, t) => {
    const key = `${format(new Date(t.tanggal_muat), 'yyyy-MM-dd')}|${format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd')}|${t.proyek_lokasi_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

  let noSummary = 1;
  let lastDateCbm: string | null = null;

  Object.entries(groupedSummary).forEach(([key, items]) => {
    const first = items[0];
    const currentDateCombo = key;
    
    let displayDate = '';
    if (currentDateCombo !== lastDateCbm) {
      displayDate = `${format(new Date(first.tanggal_muat), 'dd/MM/yyyy')}\n${format(new Date(first.tanggal_bongkar), 'dd/MM/yyyy')}`;
    }
    lastDateCbm = currentDateCombo;
    
    const totalVol = items.reduce((sum, t) => sum + t.volume, 0);
    const totalHarga = items.reduce((sum, t) => sum + t.total_harga, 0);

    mainAoa.push([
      noSummary++,
      displayDate,
      getLokasiName(first.proyek_lokasi_id),
      'CBM',
      `${items.length} Rit`,
      totalVol,
      first.harga_trip,
      totalHarga
    ]);
  });

  // Totals
  mainAoa.push([]);
  const billedVol = invoice.volume_ditagih ?? invoice.total_kubikasi;
  const prevVol = invoice.sisa_volume_sebelumnya ?? 0;
  const totalBilledVol = billedVol + prevVol;

  if (invoice.volume_ditagih !== undefined || prevVol > 0) {
    mainAoa.push(['VOLUME PENGIRIMAN INI', '', '', '', `${trips.length} Rit`, invoice.total_kubikasi, '', '']);
    mainAoa.push(['VOLUME DITAGIH PENGIRIMAN INI', '', '', '', '', billedVol, '', '']);
    if (invoice.sisa_volume !== undefined && invoice.sisa_volume > 0) {
      mainAoa.push(['SISA VOLUME (INV SELANJUTNYA)', '', '', '', '', invoice.sisa_volume, '', '']);
    }
    if (prevVol > 0) {
      mainAoa.push(['SISA VOLUME INV SEBELUMNYA', '', '', '', '', prevVol, '', '']);
    }
    mainAoa.push(['TOTAL VOLUME DITAGIHKAN INVOICE INI', '', '', '', '', totalBilledVol, '', '']);
  }

  if (invoice.is_potong_material === 1) {
    mainAoa.push(['TOTAL HARGA KOTOR', '', '', '', '', totalBilledVol, '', invoice.total_harga_kotor]);
    mainAoa.push(['POTONGAN MATERIAL', '', '', '', '', '', '', -invoice.total_potongan_material]);
    mainAoa.push(['TOTAL NILAI PO (BERSIH)', '', '', '', '', '', '', invoice.total_harga_bersih]);
  } else {
    mainAoa.push(['TOTAL NILAI PO', '', '', '', '', totalBilledVol, '', invoice.total_harga_kotor]);
  }

  mainAoa.push([]);
  mainAoa.push([`TERBILANG: # ${formatTerbilang(invoice.total_harga_bersih).toUpperCase().trim()} RUPIAH #`]);
  mainAoa.push([]);
  mainAoa.push(['Pembayaran dapat ditransfer melalui:']);
  mainAoa.push([`Bank        : ${owner.nama_bank}`]);
  mainAoa.push([`No. Rekening: ${owner.no_rek}`]);
  mainAoa.push([`Atas Nama   : ${owner.atas_nama}`]);
  mainAoa.push([]);
  mainAoa.push(['', '', '', '', '', format(new Date(invoice.tanggal_invoice), 'dd MMMM yyyy', { locale: id })]);
  mainAoa.push(['', '', '', '', '', 'Hormat kami,']);
  mainAoa.push([]);
  mainAoa.push([]);
  mainAoa.push(['', '', '', '', '', (invoice.nama_ttd || owner.nama).toUpperCase()]);

  const wsMain = XLSX.utils.aoa_to_sheet(mainAoa);
  wsMain['!cols'] = [
    { wch: 5 },  // A
    { wch: 20 }, // B
    { wch: 25 }, // C
    { wch: 15 }, // D
    { wch: 13 }, // E
    { wch: 14 }, // F
    { wch: 18 }, // G
    { wch: 18 }, // H
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, 'INVOICE');


  // ==========================================
  // SHEETS REKAP PER LOKASI
  // ==========================================
  const groupedByLokasiName = [...trips].reduce((acc, t) => {
    const lname = getLokasiName(t.proyek_lokasi_id).toUpperCase();
    if (!acc[lname]) acc[lname] = [];
    acc[lname].push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

  Object.entries(groupedByLokasiName).forEach(([lokasi, tripsLokasi]) => {
    const safeTitle = `REKAP ${lokasi.replace(/[/\\?*[\]:'"]/g, '')}`.substring(0, 31);
    const rekapAoa: (string | number)[][] = [];

    rekapAoa.push([`REKAP PENGIRIMAN CBM KE ${proyek.nama_proyek.toUpperCase()}`]);
    rekapAoa.push([`PENGIRIM: ${owner.nama.toUpperCase()}   |   LOKASI BONGKARAN: ${lokasi}`]);
    rekapAoa.push([]);
    rekapAoa.push(['NO', 'TGL MUAT & BONGKAR', 'JENIS', 'PLAT NOMOR', 'KET (KUARI)', 'VOLUME (M3)', 'TOTAL VOL/HARI']);

    const tripsByDate = tripsLokasi.reduce((acc, t) => {
      const key = `${format(new Date(t.tanggal_muat), 'yyyy-MM-dd')}|${format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd')}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
      return acc;
    }, {} as Record<string, Trip[]>);

    let rowNo = 1;
    Object.values(tripsByDate).forEach(dailyTrips => {
      const dailyVolume = dailyTrips.reduce((s, t) => s + t.volume, 0);
      dailyTrips.forEach((trip, idx) => {
        rekapAoa.push([
          rowNo++,
          idx === 0 ? `${format(new Date(trip.tanggal_muat), 'dd/MM/yy')}\n${format(new Date(trip.tanggal_bongkar), 'dd MMM yyyy', { locale: id })}` : '',
          'DT',
          trip.plat_nomor,
          getKuariName(trip.lokasi_kuari_id),
          trip.volume,
          idx === 0 ? dailyVolume : ''
        ]);
      });
    });

    rekapAoa.push([]);
    const totalLokasiVol = tripsLokasi.reduce((s, t) => s + t.volume, 0);
    rekapAoa.push(['TOTAL VOLUME', '', '', '', '', totalLokasiVol, totalLokasiVol]);

    const wsRekap = XLSX.utils.aoa_to_sheet(rekapAoa);
    wsRekap['!cols'] = [
      { wch: 5 },  // A
      { wch: 28 }, // B
      { wch: 15 }, // C
      { wch: 18 }, // D
      { wch: 20 }, // E
      { wch: 15 }, // F
      { wch: 18 }, // G
    ];
    XLSX.utils.book_append_sheet(wb, wsRekap, safeTitle);
  });

  XLSX.writeFile(wb, `Invoice_${invoice.nomor_invoice.replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`);
}
