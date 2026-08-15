import { format } from "date-fns";
import { id } from "date-fns/locale";
import { generateTerbilangText } from "@/lib/print-utils";
import type { Invoice, Trip, Owner, Proyek, ProyekLokasi, LokasiProyek, LokasiKuari } from "@/lib/db";

interface PrintInvoiceProps {
  invoice: Invoice;
  trips: Trip[];
  owner: Owner;
  proyek: Proyek;
  proyekLokasis: ProyekLokasi[];
  lokasiProyeks: LokasiProyek[];
  lokasiKuaris: LokasiKuari[];
  jenisJasas?: { id?: number; nama_js: string }[];
  jenisMaterials?: { id?: number; nama_material: string }[];
  includePhotos: boolean;
  paperSize?: string;
  printScale?: number;
  isPreview?: boolean;
  templateType?: 'standard' | 'classic';
  accentColor?: string;
}

export default function PrintInvoice({
  invoice,
  trips,
  owner,
  proyek,
  proyekLokasis,
  lokasiProyeks,
  lokasiKuaris,
  jenisJasas = [],
  jenisMaterials = [],
  includePhotos,
  paperSize = 'A4 portrait',
  printScale = 100,
  isPreview = false,
  templateType = 'standard',
  accentColor = '#00B0F0'
}: PrintInvoiceProps) {

  // Sort Summary Grouped by Muat|Bongkar|Lokasi
  const summaryTrips = [...trips].sort((a, b) => new Date(a.tanggal_bongkar).getTime() - new Date(b.tanggal_bongkar).getTime());

  // --- PERBAIKAN: Pembuatan Hash Map untuk performa O(1) ---
  const materialMap = jenisMaterials.reduce((acc, m) => {
    if (m.id != null) acc[m.id] = m.nama_material;
    return acc;
  }, {} as Record<number, string>);

  const jasaMap = jenisJasas.reduce((acc, j) => {
    if (j.id != null) acc[j.id] = j.nama_js;
    return acc;
  }, {} as Record<number, string>);

  // --- PERBAIKAN: Split trips by Group (Unique Logic vs UI Label) ---
  const tripGroups = summaryTrips.reduce((acc, t) => {
    const material = t.jenis_material_id != null ? materialMap[t.jenis_material_id] : null;
    
    // 1. Kunci Unik di belakang layar (kombinasi ID Material & ID Jasa)
    const idMat = t.jenis_material_id ?? '0';
    const idJas = t.jenis_jasa_id ?? '0';
    const uniqueKey = `${idMat}-${idJas}`;

    // 2. Label yang akan muncul di layar (HANYA MATERIAL)
    const displayLabel = (material ? material : 'CBM').toUpperCase();

    if (!acc[uniqueKey]) {
      acc[uniqueKey] = {
        label: displayLabel,
        trips: []
      };
    }
    
    acc[uniqueKey].trips.push(t);
    return acc;
  }, {} as Record<string, { label: string; trips: Trip[] }>);


  // For Rekap and Photos Grouped by Lokasi Name
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

  const groupedByLokasiName = [...trips].reduce((acc, t) => {
    const lname = getLokasiName(t.proyek_lokasi_id).toUpperCase();
    if (!acc[lname]) acc[lname] = [];
    acc[lname].push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

  // Sort each lokasi group
  Object.keys(groupedByLokasiName).forEach(k => {
    groupedByLokasiName[k].sort((a, b) => {
      if (a.tanggal_bongkar !== b.tanggal_bongkar) return new Date(a.tanggal_bongkar).getTime() - new Date(b.tanggal_bongkar).getTime();
      return a.plat_nomor.localeCompare(b.plat_nomor);
    });
  });

  return (
    <div className={isPreview ? "printable-invoice bg-white text-black p-8 w-full max-w-4xl mx-auto" : "hidden print:block printable-invoice"}>
      <style type="text/css" media="print">
        {`
          @page {
            size: ${paperSize} !important;
            margin: 5mm;
          }
          .printable-invoice {
            zoom: ${printScale / 100} !important;
          }
        `}
      </style>

      {templateType === 'classic' ? (
        /* === TEMPLATE 2: KLASIK RINGKAS (TAMPLATE_INV_2.pdf) === */
        <div className="classic-template font-sans text-black">
          {/* Header INVOICE & No */}
          <div className="text-center mb-6">
            <h1 className="text-[20px] font-bold tracking-wider border-b-2 inline-block border-black pb-0.5">INVOICE</h1>
            <p className="text-sm font-semibold mt-1">No. {invoice.nomor_invoice}</p>
          </div>

          {/* Customer & Info Table */}
          <table className="w-full mb-6 text-sm border-none">
            <tbody>
              <tr>
                <td className="w-[55%] align-top border-none p-1 leading-relaxed">
                  <div className="font-semibold text-gray-700">Kepada Yth.</div>
                  <div className="font-bold text-base">{invoice.kepada_custom ? invoice.kepada_custom.toUpperCase() : proyek.nama_proyek.toUpperCase()}</div>
                  <div>Di</div>
                  <div>Pekanbaru</div>
                </td>
                <td className="w-[45%] align-top border-none p-1">
                  <table className="w-full border-none text-xs">
                    <tbody>
                      <tr>
                        <td className="w-[45%] font-medium border-none p-0.5">Tanggal</td>
                        <td className="w-[55%] border-none p-0.5">: {format(new Date(invoice.tanggal_invoice), 'dd/MM/yyyy')}</td>
                      </tr>
                      <tr>
                        <td className="font-medium border-none p-0.5">Mata Uang</td>
                        <td className="border-none p-0.5">: IDR</td>
                      </tr>
                      <tr>
                        <td className="font-medium border-none p-0.5">Cara Pembayaran</td>
                        <td className="border-none p-0.5">: Transfer</td>
                      </tr>
                      <tr>
                        <td className="font-medium border-none p-0.5">Tgl Jatuh Tempo</td>
                        <td className="border-none p-0.5">: -</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Classic Main Table */}
          <table className="w-full text-xs mb-0 border-collapse border border-black">
            <thead>
              <tr style={{ backgroundColor: accentColor, color: '#000' }} className="font-bold border-b border-black">
                <th className="border border-black p-2 text-center w-[5%]" rowSpan={2}>NO</th>
                <th className="border border-black p-2 text-center w-[30%]" rowSpan={2}>DESKRIPSI</th>
                <th className="border border-black p-2 text-center w-[20%]" rowSpan={2}>No.Kontrak Kontraktor</th>
                <th className="border border-black p-1 text-center" colSpan={4}>AMMOUNT</th>
              </tr>
              <tr style={{ backgroundColor: accentColor, color: '#000' }} className="font-bold border-b border-black">
                <th className="border border-black p-1 text-center w-[10%]">Qty</th>
                <th className="border border-black p-1 text-center w-[10%]">Satuan</th>
                <th className="border border-black p-1 text-right w-[12.5%]">Harga Satuan</th>
                <th className="border border-black p-1 text-right w-[12.5%]">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Pengiriman Utama */}
              <tr>
                <td className="border border-black p-2 text-center align-top">1</td>
                <td className="border border-black p-2 align-top">
                  <div className="font-bold">CBM Tanah Timbun / Pengiriman Material</div>
                  <div className="text-[10px] text-gray-600">Total Volume: {invoice.total_kubikasi} M³ ({trips.length} Rit)</div>
                </td>
                <td className="border border-black p-2 align-top">
                  <div className="h-10 border-b border-dashed border-gray-300"></div>
                </td>
                <td className="border border-black p-2 text-center align-top font-semibold">{(invoice.volume_ditagih ?? invoice.total_kubikasi).toLocaleString('id-ID')}</td>
                <td className="border border-black p-2 text-center align-top font-semibold">M3</td>
                <td className="border border-black p-2 text-right align-top font-medium">{(invoice.harga_per_kubik ? Math.round(invoice.harga_per_kubik) : Math.round(invoice.total_harga_kotor / ((invoice.volume_ditagih ?? invoice.total_kubikasi) || 1))).toLocaleString('id-ID')}</td>
                <td className="border border-black p-2 text-right align-top font-bold">Rp {invoice.total_harga_kotor.toLocaleString('id-ID')}</td>
              </tr>

              {/* Row 2: Sisa Volume Inv Sebelumnya if any */}
              {invoice.sisa_volume_sebelumnya !== undefined && invoice.sisa_volume_sebelumnya > 0 && (
                <tr className="bg-blue-50/40">
                  <td className="border border-black p-2 text-center align-top">2</td>
                  <td className="border border-black p-2 align-top font-semibold">+ Sisa Volume Inv Sebelumnya</td>
                  <td className="border border-black p-2 align-top"></td>
                  <td className="border border-black p-2 text-center align-top font-bold">{invoice.sisa_volume_sebelumnya.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-2 text-center align-top font-semibold">M3</td>
                  <td className="border border-black p-2 text-right align-top font-medium">{(invoice.harga_per_kubik ? Math.round(invoice.harga_per_kubik) : 0).toLocaleString('id-ID')}</td>
                  <td className="border border-black p-2 text-right align-top font-bold">Rp {((invoice.sisa_volume_sebelumnya) * (invoice.harga_per_kubik || 0)).toLocaleString('id-ID')}</td>
                </tr>
              )}

              {/* TOTAL PO Row */}
              <tr className="font-bold">
                <td colSpan={5} className="border-none"></td>
                <td className="border border-black p-2 text-right bg-gray-100">TOTAL PO</td>
                <td className="border border-black p-2 text-right bg-gray-100">Rp {invoice.total_harga_kotor.toLocaleString('id-ID')}</td>
              </tr>

              {/* Potongan Material Row */}
              {invoice.is_potong_material === 1 && (
                <tr className="font-bold text-red-600">
                  <td colSpan={5} className="border-none"></td>
                  <td className="border border-black p-2 text-right bg-red-50">POTONGAN MATERIAL</td>
                  <td className="border border-black p-2 text-right bg-red-50">- Rp {invoice.total_potongan_material.toLocaleString('id-ID')}</td>
                </tr>
              )}

              {/* GRAND TOTAL Row */}
              <tr className="font-extrabold text-sm" style={{ backgroundColor: accentColor, color: '#000' }}>
                <td colSpan={5} className="border-none"></td>
                <td className="border border-black p-2 text-right">GRAND TOTAL</td>
                <td className="border border-black p-2 text-right">Rp {invoice.total_harga_bersih.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          {/* Terbilang Full Width Box */}
          <div style={{ backgroundColor: accentColor, filter: 'brightness(0.95)', color: '#000' }} className="p-2 border border-black font-semibold italic text-xs mb-8">
            Terbilang : {generateTerbilangText(invoice.total_harga_bersih)}
          </div>

          {/* Bank & Signature Section */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div style={{ backgroundColor: accentColor, opacity: 0.35, color: '#000' }} className="p-3 border border-black rounded-sm space-y-1">
              <p className="font-bold underline mb-2">Mohon pembayaran di transfer ke rekening berikut:</p>
              <p><strong>Nama</strong> : {owner.atas_nama}</p>
              <p><strong>Nama Bank</strong> : {owner.nama_bank}</p>
              <p><strong>Nomor Rekening</strong> : {owner.no_rek}</p>
            </div>

            <div className="text-center flex flex-col justify-between items-center py-1">
              <p className="font-semibold">Hormat Kami,</p>
              <div className="h-14"></div>
              <p className="font-bold underline text-sm">{(invoice.nama_ttd || owner.nama).toUpperCase()}</p>
            </div>
          </div>
        </div>
      ) : (
        /* === TEMPLATE 1: STANDAR / DETAIL (Grouped Trips Summary) === */
        <>
          <div className="text-center font-bold underline mb-5 text-[16px]">INVOICE</div>

          <table className="info-table w-full mb-5 border-none">
            <tbody>
              <tr>
                <td className="w-[10%] border-none p-1">Kepada</td>
                <td className="w-[50%] border-none p-1">: <span className="font-bold">{invoice.kepada_custom ? invoice.kepada_custom.toUpperCase() : proyek.nama_proyek.toUpperCase()}</span></td>
                <td className="w-[10%] text-right border-none p-1">Nomor</td>
                <td className="w-[30%] border-none p-1">: {invoice.nomor_invoice}</td>
              </tr>
              <tr>
                <td className="border-none p-1">Pemasok</td>
                <td className="border-none p-1">: {owner.nama.toUpperCase()}</td>
                <td className="text-right border-none p-1">Tanggal</td>
                <td className="border-none p-1">: {format(new Date(invoice.tanggal_invoice), 'EEEE, dd MMMM yyyy', { locale: id })}</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-2">Mohon dibayarkan sesuai dengan rincian berikut:</p>

          {Object.entries(tripGroups).map(([uniqueKey, groupData]) => {
            const groupLabel = groupData.label;
            const groupTrips = groupData.trips;

            const groupedSummary = groupTrips.reduce((acc, t) => {
              const key = `${format(new Date(t.tanggal_muat), 'yyyy-MM-dd')}|${format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd')}|${t.proyek_lokasi_id}|${t.harga_trip}`;
              if (!acc[key]) acc[key] = [];
              acc[key].push(t);
              return acc;
            }, {} as Record<string, Trip[]>);

            let noSummary = 1;
            let lastDateCbm: string | null = null;
            const totalVolumeGroup = groupTrips.reduce((s, t) => s + t.volume, 0);
            const totalKotorGroup = groupTrips.reduce((s, t) => s + (t.total_harga || (t.volume * t.harga_trip)), 0);
            const totalPotonganGroup = groupTrips.reduce((s, t) => s + (t.potongan_material_invoice || 0), 0);
            const totalBersihGroup = totalKotorGroup - totalPotonganGroup;

            return (
              <div key={uniqueKey} className="mb-6">
                <h3 className="font-bold mb-2">{groupLabel}</h3>
                <table className="main-table w-full">
                  <thead style={{ backgroundColor: totalPotonganGroup > 0 ? '#fbbf24' : accentColor, color: '#000' }}>
                    <tr>
                      <th className="w-[5%]">NO</th>
                      <th className="w-[20%]">TGL MUAT/BKR</th>
                      <th className="w-[15%]">STA / LOKASI</th>
                      <th className="w-[10%]">MATERIAL</th>
                      <th className="w-[10%]">RITASE</th>
                      <th className="w-[10%]">VOL (M3)</th>
                      <th className="w-[15%]">Harga (Rp)</th>
                      <th className="w-[15%]">Nilai PO (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedSummary).map(([key, items]) => {
                      const first = items[0];
                      const currentDateCombo = key;

                      let displayDate = null;
                      if (currentDateCombo !== lastDateCbm) {
                        displayDate = (
                          <>
                            {format(new Date(first.tanggal_muat), 'EEEE, dd MMM yyyy', { locale: id })}<br />
                            {format(new Date(first.tanggal_bongkar), 'EEEE, dd MMM yyyy', { locale: id })}
                          </>
                        );
                      }

                      const borderTop = (currentDateCombo !== lastDateCbm && noSummary > 1) ? 'border-t-2 border-black' : '';
                      lastDateCbm = currentDateCombo;

                      const totalVol = items.reduce((sum, t) => sum + t.volume, 0);
                      const totalHarga = items.reduce((sum, t) => sum + (t.total_harga || (t.volume * t.harga_trip)), 0);

                      return (
                        <tr key={key}>
                          <td className={`text-center ${borderTop}`}>{noSummary++}</td>
                          <td className={`text-center ${borderTop}`}>{displayDate}</td>
                          <td className={`text-center ${borderTop}`}>{getLokasiName(first.proyek_lokasi_id)}</td>
                          <td className={`text-center ${borderTop}`}>{groupLabel}</td>
                          <td className={`text-center ${borderTop}`}>{items.length} Rit</td>
                          <td className={`text-right ${borderTop}`}>{totalVol.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                          <td className={`text-right ${borderTop}`}>Rp {first.harga_trip.toLocaleString('id-ID')}</td>
                          <td className={`text-right ${borderTop}`}>Rp {totalHarga.toLocaleString('id-ID')}</td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-[#f0f0f0]">
                      <td colSpan={4} className="text-center">TOTAL {groupLabel}</td>
                      <td className="text-center">{groupTrips.length} Rit</td>
                      <td className="text-right">{totalVolumeGroup.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                      <td></td>
                      <td className="text-right">Rp {totalKotorGroup.toLocaleString('id-ID')}</td>
                    </tr>
                    {totalPotonganGroup > 0 && (
                      <>
                        <tr className="font-bold text-red-600">
                          <td colSpan={7} className="text-right">POTONGAN MATERIAL ({groupLabel})</td>
                          <td className="text-right">- Rp {totalPotonganGroup.toLocaleString('id-ID')}</td>
                        </tr>
                        <tr className="font-bold bg-[#f0f0f0]">
                          <td colSpan={7} className="text-right">TOTAL {groupLabel} </td>
                          <td className="text-right">Rp {totalBersihGroup.toLocaleString('id-ID')}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Volume Summary Banner */}
          {((invoice.sisa_volume !== undefined && invoice.sisa_volume > 0) || (invoice.sisa_volume_sebelumnya !== undefined && invoice.sisa_volume_sebelumnya > 0)) && (
            <div className="mb-4 text-xs p-2 bg-gray-100 border border-gray-300 font-semibold rounded space-y-1">
              <div className="flex justify-between">
                <span>Vol Pengiriman Ini: <strong>{invoice.total_kubikasi.toLocaleString('id-ID')} M³</strong></span>
                <span>Ditagihkan Pengiriman Ini: <strong>{(invoice.volume_ditagih ?? invoice.total_kubikasi).toLocaleString('id-ID')} M³</strong></span>
                {invoice.sisa_volume !== undefined && invoice.sisa_volume > 0 && (
                  <span className="text-amber-700">Sisa Vol Next Inv: <strong>{invoice.sisa_volume.toLocaleString('id-ID')} M³</strong></span>
                )}
              </div>
              {invoice.sisa_volume_sebelumnya !== undefined && invoice.sisa_volume_sebelumnya > 0 && (
                <div className="flex justify-between pt-1 border-t border-gray-300 text-blue-900">
                  <span>+ Sisa Vol Inv Sebelumnya: <strong>{invoice.sisa_volume_sebelumnya.toLocaleString('id-ID')} M³</strong></span>
                  <span>TOTAL VOL DITAGIHKAN: <strong>{((invoice.volume_ditagih ?? invoice.total_kubikasi) + invoice.sisa_volume_sebelumnya).toLocaleString('id-ID')} M³</strong></span>
                </div>
              )}
            </div>
          )}

          <table className="main-table w-full mb-4">
            <tbody>
              <tr style={{ backgroundColor: accentColor, color: '#000' }} className="font-bold text-[15px]">
                <td className="text-center w-[70%]">TOTAL TAGIHAN BERSIH (GRAND TOTAL)</td>
                <td className="text-right w-[30%]">Rp {invoice.total_harga_bersih.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 italic bg-[#f9f9f9] p-3 border-l-4 border-gray-400 font-bold">
            {generateTerbilangText(invoice.total_harga_bersih)}
          </div>

          <div className="mt-5">
            <p><strong>Pembayaran dapat ditransfer ke:</strong><br />
              {owner.nama_bank}: {owner.no_rek} A.n {owner.atas_nama}
            </p>
          </div>

          <table className="w-full mt-12 border-none">
            <tbody>
              <tr>
                <td className="w-[70%] border-none"></td>
                <td className="w-[30%] text-center border-none">
                  {format(new Date(invoice.tanggal_invoice), 'EEEE, dd MMMM yyyy', { locale: id })}<br />
                  Hormat kami,<br /><br /><br /><br /><br />
                  <strong>{(invoice.nama_ttd || owner.nama).toUpperCase()}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      <div className="mt-5">
        <p><strong>Pembayaran dapat ditransfer ke:</strong><br />
          {owner.nama_bank}: {owner.no_rek} A.n {owner.atas_nama}
        </p>
      </div>

      <table className="w-full mt-12 border-none">
        <tbody>
          <tr>
            <td className="w-[70%] border-none"></td>
            <td className="w-[30%] text-center border-none">
              {format(new Date(invoice.tanggal_invoice), 'EEEE, dd MMMM yyyy', { locale: id })}<br />
              Hormat kami,<br /><br /><br /><br /><br />
              <strong>{(invoice.nama_ttd || owner.nama).toUpperCase()}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* REKAP DETAIL PER LOKASI */}
      {Object.entries(groupedByLokasiName).map(([lokasi, tripsLokasi]) => (
        <div key={lokasi} className="page-break-before-always" style={{ pageBreakBefore: 'always', marginTop: '40px' }}>
          <div className="text-center font-bold text-[14px] mb-2 leading-relaxed">
            REKAP PENGIRIMAN KE {proyek.nama_proyek.toUpperCase()}<br />
            PENGIRIM {owner.nama.toUpperCase()}
          </div>

          <div className="font-bold mb-1">LOKASI BONGKARAN: {lokasi}</div>

          <table className="table-bordered info-table w-full">
            <thead className="bg-[#00B0F0] text-black">
              <tr>
                <th className="w-[5%]">NO</th>
                <th className="w-[29%]">TGL MUAT & BONGKAR</th>
                <th className="w-[6%]">Jenis</th>
                <th className="w-[15%]">PLAT NOMOR</th>
                <th className="w-[15%]">KET</th>
                <th className="w-[14%]">VOLUME (M3)</th>
                <th className="w-[18%]">TOTAL VOLUME (M3)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let totalVolumeLokasi = 0;
                // Group by date combo inside the location
                const tripsByDate = tripsLokasi.reduce((acc, t) => {
                  const key = `${format(new Date(t.tanggal_muat), 'yyyy-MM-dd')}|${format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd')}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(t);
                  return acc;
                }, {} as Record<string, Trip[]>);

                return Object.entries(tripsByDate).map(([, dailyTrips]) => {
                  const dailyVolume = dailyTrips.reduce((s, t) => s + t.volume, 0);
                  totalVolumeLokasi += dailyVolume;
                  let dailyNo = 1;

                  return dailyTrips.map((trip, idx) => (
                    <tr key={trip.id}>
                      <td className="text-center">{dailyNo++}</td>
                      <td className="text-center" style={{ borderTop: idx === 0 ? '1px solid #000' : 'none', borderBottom: idx === dailyTrips.length - 1 ? '1px solid #000' : 'none' }}>
                        {idx === 0 && (
                          <>
                            <span className="text-xs text-gray-500">M:</span> {format(new Date(trip.tanggal_muat), 'EEEE, dd MMM yyyy', { locale: id })}<br />
                            <span className="text-xs text-gray-500">B:</span> {format(new Date(trip.tanggal_bongkar), 'EEEE, dd MMM yyyy', { locale: id })}
                          </>
                        )}
                      </td>
                      <td className="text-center">DT</td>
                      <td className="text-center font-bold">{trip.plat_nomor}</td>
                      <td className="text-center">{getKuariName(trip.lokasi_kuari_id)}</td>
                      <td className="text-center">{trip.volume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                      <td className="text-center font-bold" style={{ background: idx === 0 ? '#f0f0f0' : 'transparent', borderTop: idx === 0 ? '1px solid #000' : 'none', borderBottom: idx === dailyTrips.length - 1 ? '1px solid #000' : 'none' }}>
                        {idx === 0 ? dailyVolume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : ''}
                      </td>
                    </tr>
                  ));
                }).concat([
                  <tr key="total" className="bg-[#f0f0f0] font-bold">
                    <td colSpan={6} className="text-center">TOTAL VOLUME</td>
                    <td className="text-right">{totalVolumeLokasi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                  </tr>
                ]);
              })()}
            </tbody>
          </table>
        </div>
      ))}

      {/* FOTO BUKTI DO */}
      {includePhotos && (
        <div className="page-break-before-always" style={{ pageBreakBefore: 'always', marginTop: '40px' }}>
          <div className="text-center font-bold text-[14px] mb-5 underline">
            LAMPIRAN BUKTI DELIVERY ORDER (DO)
          </div>

          <div className="w-full">
            {Object.entries(groupedByLokasiName).map(([lokasi, tripsLokasi]) => {
              const tripsWithPhotos = tripsLokasi.filter(t => t.bukti_do);
              if (tripsWithPhotos.length === 0) return null;

              return (
                <div key={lokasi} className="mb-6 w-full">
                  <div className="font-bold mb-2 p-1 border-b-2 border-black text-sm">LOKASI BONGKARAN: {lokasi}</div>
                  <div className="flex flex-wrap w-full">
                    {tripsWithPhotos.map((trip) => (
                      <div key={trip.id} className="w-[50%] p-2 text-center border border-dashed border-gray-300">
                        <div className="font-bold text-[11px] mb-1">
                          {trip.plat_nomor} - {format(new Date(trip.tanggal_bongkar), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-[10px] mb-2">
                          Vol: {trip.volume} M³ | Muat: {getKuariName(trip.lokasi_kuari_id)}
                        </div>
                        <img src={trip.bukti_do} className="max-w-[90%] max-h-[250px] object-contain border border-gray-200 p-[2px] mx-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
} 
