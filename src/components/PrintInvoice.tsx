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
  includePhotos: boolean;
  paperSize?: string;
  printScale?: number;
  isPreview?: boolean;
}

export default function PrintInvoice({
  invoice,
  trips,
  owner,
  proyek,
  proyekLokasis,
  lokasiProyeks,
  lokasiKuaris,
  includePhotos,
  paperSize = 'A4 portrait',
  printScale = 100,
  isPreview = false
}: PrintInvoiceProps) {

  // Sort Summary Grouped by Muat|Bongkar|Lokasi
  const summaryTrips = [...trips].sort((a, b) => new Date(a.tanggal_bongkar).getTime() - new Date(b.tanggal_bongkar).getTime());

  const groupedSummary = summaryTrips.reduce((acc, t) => {
    const key = `${format(new Date(t.tanggal_muat), 'yyyy-MM-dd')}|${format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd')}|${t.proyek_lokasi_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

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

  let noSummary = 1;
  let lastDateCbm: string | null = null;

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

      <table className="main-table w-full mb-4">
        <thead className="bg-[#00B0F0] text-black">
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
            const totalHarga = totalVol * first.harga_trip;

            return (
              <tr key={key}>
                <td className={`text-center ${borderTop}`}>{noSummary++}</td>
                <td className={`text-center ${borderTop}`}>{displayDate}</td>
                <td className={`text-center ${borderTop}`}>{getLokasiName(first.proyek_lokasi_id)}</td>
                <td className={`text-center ${borderTop}`}>CBM</td>
                <td className={`text-center ${borderTop}`}>{items.length} Rit</td>
                <td className={`text-right ${borderTop}`}>{totalVol.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={`text-right ${borderTop}`}>Rp {first.harga_trip.toLocaleString('id-ID')}</td>
                <td className={`text-right ${borderTop}`}>Rp {totalHarga.toLocaleString('id-ID')}</td>
              </tr>
            );
          })}

          {invoice.is_potong_material === 1 ? (
            <>
              <tr className="font-bold">
                <td colSpan={4} className="text-center">TOTAL HARGA KOTOR</td>
                <td className="text-center">{trips.length} Rit</td>
                <td className="text-right">{invoice.total_kubikasi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td></td>
                <td className="text-right">Rp {(invoice.total_harga_kotor).toLocaleString('id-ID')}</td>
              </tr>
              <tr className="font-bold text-red-600">
                <td colSpan={7} className="text-right">POTONGAN MATERIAL</td>
                <td className="text-right">- Rp {invoice.total_potongan_material.toLocaleString('id-ID')}</td>
              </tr>
              <tr className="font-bold bg-[#f0f0f0]">
                <td colSpan={7} className="text-right">TOTAL NILAI PO (BERSIH)</td>
                <td className="text-right">Rp {invoice.total_harga_bersih.toLocaleString('id-ID')}</td>
              </tr>
            </>
          ) : (
            <tr className="font-bold bg-[#f0f0f0]">
              <td colSpan={4} className="text-center">TOTAL NILAI PO</td>
              <td className="text-center">{trips.length} Rit</td>
              <td className="text-right">{invoice.total_kubikasi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td></td>
              <td className="text-right">Rp {invoice.total_harga_kotor.toLocaleString('id-ID')}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 italic bg-[#f9f9f9] p-3 border-l-4 border-gray-400 font-bold">
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

      {/* REKAP DETAIL PER LOKASI */}
      {Object.entries(groupedByLokasiName).map(([lokasi, tripsLokasi]) => (
        <div key={lokasi} className="page-break-before-always" style={{ pageBreakBefore: 'always', marginTop: '40px' }}>
          <div className="text-center font-bold text-[14px] mb-2 leading-relaxed">
            REKAP PENGIRIMAN CBM KE {proyek.nama_proyek.toUpperCase()}<br />
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
                      <td className="text-center">{trip.volume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="text-center font-bold" style={{ background: idx === 0 ? '#f0f0f0' : 'transparent', borderTop: idx === 0 ? '1px solid #000' : 'none', borderBottom: idx === dailyTrips.length - 1 ? '1px solid #000' : 'none' }}>
                        {idx === 0 ? dailyVolume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                      </td>
                    </tr>
                  ));
                }).concat([
                  <tr key="total" className="bg-[#f0f0f0] font-bold">
                    <td colSpan={6} className="text-center">TOTAL VOLUME</td>
                    <td className="text-right">{totalVolumeLokasi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
