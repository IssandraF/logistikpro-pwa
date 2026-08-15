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

  // Hash Map untuk performa O(1)
  const materialMap = jenisMaterials.reduce((acc, m) => {
    if (m.id != null) acc[m.id] = m.nama_material;
    return acc;
  }, {} as Record<number, string>);

  const jasaMap = jenisJasas.reduce((acc, j) => {
    if (j.id != null) acc[j.id] = j.nama_js;
    return acc;
  }, {} as Record<number, string>);

  // Split trips by Group
  const tripGroups = summaryTrips.reduce((acc, t) => {
    const material = t.jenis_material_id != null ? materialMap[t.jenis_material_id] : null;

    const idMat = t.jenis_material_id ?? '0';
    const idJas = t.jenis_jasa_id ?? '0';
    const uniqueKey = `${idMat}-${idJas}`;

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
        /* === TEMPLATE 2: KLASIK RINGKAS === */
        <div className="font-sans text-black text-[11px]">

          {/* Header: Nama Perusahaan + INVOICE */}
          <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-black">
            <div>
              <div className="text-[15px] font-extrabold tracking-widest">{owner.nama.toUpperCase()}</div>
              {owner.alamat && <div className="text-[10px] text-gray-500 mt-0.5">{owner.alamat}</div>}
            </div>
            <div className="text-right">
              <div className="text-[22px] font-extrabold tracking-[0.12em]">INVOICE</div>
              <div className="text-[10px] mt-0.5">No. <strong>{invoice.nomor_invoice}</strong></div>
              <div className="text-[10px]">Tanggal : <strong>{format(new Date(invoice.tanggal_invoice), 'dd/MM/yyyy')}</strong></div>
            </div>
          </div>

          {/* Kepada & Info Pembayaran */}
          <div className="flex justify-between items-start mb-4">
            <div className="leading-snug">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Kepada Yth.</div>
              <div className="text-[12px] font-bold">
                {invoice.kepada_custom ? invoice.kepada_custom.toUpperCase() : proyek.nama_proyek.toUpperCase()}
              </div>
              <div className="text-[10px] text-gray-500">Di - Tempat</div>
            </div>
            <div className="text-[10px] text-right space-y-0.5">
              <div><span className="font-medium">Mata Uang</span> : IDR</div>
              <div><span className="font-medium">Cara Pembayaran</span> : Transfer Bank</div>
              <div><span className="font-medium">Jatuh Tempo</span> : -</div>
            </div>
          </div>

          {/* Tabel Utama */}
          <table className="w-full border-collapse text-[10px]">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '33%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: accentColor }} className="text-black font-bold text-center">
                <th className="border border-black py-1.5 px-1 align-middle" rowSpan={2}>NO</th>
                <th className="border border-black py-1.5 px-2 align-middle" rowSpan={2}>DESKRIPSI</th>
                <th className="border border-black py-1.5 px-2 align-middle" rowSpan={2}>No. Kontrak Kontraktor</th>
                <th className="border border-black py-1 px-1" colSpan={4}>AMOUNT</th>
              </tr>
              <tr style={{ backgroundColor: accentColor }} className="text-black font-bold text-center">
                <th className="border border-black py-1 px-1">Qty</th>
                <th className="border border-black py-1 px-1">Sat.</th>
                <th className="border border-black py-1 px-1">Harga Satuan (Rp)</th>
                <th className="border border-black py-1 px-1">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {/* Baris 1 — Pengiriman */}
              <tr className="align-top">
                <td className="border border-black py-3 px-1 text-center">1</td>
                <td className="border border-black py-3 px-2">
                  <div className="font-bold">Pengiriman Material / Tanah Timbun</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {trips.length} Ritase &mdash; Vol. Total: {invoice.total_kubikasi.toLocaleString('id-ID')} M³
                  </div>
                </td>
                <td className="border border-black py-3 px-2 text-center text-gray-400 italic text-[9px]">—</td>
                <td className="border border-black py-3 px-1 text-right font-semibold">
                  {(invoice.volume_ditagih ?? invoice.total_kubikasi).toLocaleString('id-ID')}
                </td>
                <td className="border border-black py-3 px-1 text-center font-semibold">M³</td>
                <td className="border border-black py-3 px-2 text-right">
                  {(invoice.harga_per_kubik
                    ? Math.round(invoice.harga_per_kubik)
                    : Math.round(invoice.total_harga_kotor / ((invoice.volume_ditagih ?? invoice.total_kubikasi) || 1))
                  ).toLocaleString('id-ID')}
                </td>
                <td className="border border-black py-3 px-2 text-right font-bold">
                  {invoice.total_harga_kotor.toLocaleString('id-ID')}
                </td>
              </tr>

              {/* Baris 2 — Sisa Volume Invoice Sebelumnya */}
              {invoice.sisa_volume_sebelumnya !== undefined && invoice.sisa_volume_sebelumnya > 0 && (
                <tr className="align-top bg-blue-50">
                  <td className="border border-black py-3 px-1 text-center">2</td>
                  <td className="border border-black py-3 px-2 font-semibold">
                    Sisa Volume Invoice Sebelumnya
                  </td>
                  <td className="border border-black py-3 px-2 text-center text-gray-400 italic text-[9px]">—</td>
                  <td className="border border-black py-3 px-1 text-right font-semibold">
                    {invoice.sisa_volume_sebelumnya.toLocaleString('id-ID')}
                  </td>
                  <td className="border border-black py-3 px-1 text-center font-semibold">M³</td>
                  <td className="border border-black py-3 px-2 text-right">
                    {(invoice.harga_per_kubik ? Math.round(invoice.harga_per_kubik) : 0).toLocaleString('id-ID')}
                  </td>
                  <td className="border border-black py-3 px-2 text-right font-bold">
                    {(invoice.sisa_volume_sebelumnya * (invoice.harga_per_kubik || 0)).toLocaleString('id-ID')}
                  </td>
                </tr>
              )}

              {/* Baris kosong agar ada jarak */}
              <tr><td className="border border-black py-3" colSpan={7}></td></tr>

              {/* Sub Total */}
              <tr className="font-bold bg-gray-50">
                <td colSpan={5} className="border border-black py-1.5 px-2 text-right">Sub Total</td>
                <td className="border border-black py-1.5 px-2 text-right">Rp</td>
                <td className="border border-black py-1.5 px-2 text-right">
                  {invoice.total_harga_kotor.toLocaleString('id-ID')}
                </td>
              </tr>

              {/* Potongan Material */}
              {invoice.is_potong_material === 1 && (
                <tr className="font-bold text-red-700 bg-red-50">
                  <td colSpan={5} className="border border-black py-1.5 px-2 text-right">Potongan Material</td>
                  <td className="border border-black py-1.5 px-2 text-right">Rp</td>
                  <td className="border border-black py-1.5 px-2 text-right">
                    ({invoice.total_potongan_material.toLocaleString('id-ID')})
                  </td>
                </tr>
              )}

              {/* Grand Total */}
              <tr className="font-extrabold text-[11px]" style={{ backgroundColor: accentColor, color: '#000' }}>
                <td colSpan={5} className="border border-black py-2 px-2 text-right uppercase tracking-wide">Grand Total</td>
                <td className="border border-black py-2 px-2 text-right">Rp</td>
                <td className="border border-black py-2 px-2 text-right">
                  {invoice.total_harga_bersih.toLocaleString('id-ID')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Terbilang */}
          <div
            className="border border-t-0 border-black px-3 py-2 text-[10px] mb-6"
            style={{ backgroundColor: accentColor }}
          >
            <span className="font-bold">Terbilang :</span>&nbsp;
            <span className="italic">{generateTerbilangText(invoice.total_harga_bersih)}</span>
          </div>

          {/* Rekening & Tanda Tangan Classic */}
          <div className="flex gap-6 mt-2 text-[10px]">
            <div className="flex-1 border border-black p-3" style={{ backgroundColor: accentColor }}>
              <div className="font-bold underline mb-2 text-[11px]">Mohon pembayaran ditransfer ke rekening:</div>
              <table className="w-full border-none text-[10px]">
                <tbody>
                  <tr>
                    <td className="border-none py-0.5 w-[36%] font-medium">Nama</td>
                    <td className="border-none py-0.5">: <strong>{owner.atas_nama}</strong></td>
                  </tr>
                  <tr>
                    <td className="border-none py-0.5 font-medium">Bank</td>
                    <td className="border-none py-0.5">: <strong>{owner.nama_bank}</strong></td>
                  </tr>
                  <tr>
                    <td className="border-none py-0.5 font-medium">No. Rekening</td>
                    <td className="border-none py-0.5">: <strong>{owner.no_rek}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="w-[200px] text-center flex flex-col items-center justify-between">
              <div className="text-[10px] mb-1">
                {format(new Date(invoice.tanggal_invoice), 'dd MMMM yyyy', { locale: id })}
              </div>
              <div className="font-semibold text-[10px] mb-10">Hormat Kami,</div>
              <div className="border-t border-black w-full pt-1 font-bold text-[10px]">
                {(invoice.nama_ttd || owner.nama).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* === TEMPLATE 1: STANDAR / DETAIL === */
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

          {/* Rekening & Tanda Tangan Standard */}
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
                        <img src={trip.bukti_do} className="max-w-[90%] max-h-[250px] object-contain border border-gray-200 p-[2px] mx-auto" alt="Bukti DO" />
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