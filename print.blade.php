<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Buku Besar Kas Bon - {{ $grup->nama_grup }}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #333; }
        .page-break { page-break-after: always; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; }
        .text-center { text-align: center; }
        .text-end { text-align: right; }
        .fw-bold { font-weight: bold; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h2 { margin: 0 0 5px 0; font-size: 20px; }
        .header p { margin: 0; color: #666; }
        .text-danger { color: #dc3545; }
        .text-success { color: #198754; }
        .text-primary { color: #0d6efd; }
        
        .lampiran-section { margin-top: 30px; }
        .slip-box { border: 1px solid #000; margin-bottom: 20px; padding: 15px; page-break-inside: avoid; }
        .slip-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; font-weight: bold; font-size: 14px; }
        .trip-table th, .trip-table td { border: 1px solid #000; padding: 5px; font-size: 11px; }
        .summary-table { width: 40%; float: right; margin-top: 10px; }
        .summary-table td { padding: 4px; border: none; }
        .summary-table .total-row td { border-top: 2px solid #000; font-weight: bold; }
        .clearfix::after { content: ""; clear: both; display: table; }
        
        .bukti-box { display: inline-block; width: 45%; margin: 10px 2%; text-align: center; border: 1px solid #ddd; padding: 10px; page-break-inside: avoid; vertical-align: top; }
        .bukti-box img { max-width: 100%; max-height: 300px; height: auto; display: block; margin: 0 auto 10px auto; }
        
        @media print {
            body { font-size: 10px; }
            .no-print { display: none; }
            .slip-box, .bukti-box { page-break-inside: avoid; }
        }
    </style>
</head>
<body onload="window.print()">

    <!-- HALAMAN 1: RINGKASAN BUKU BESAR -->
    <div class="header">
        <h2>RINGKASAN BUKU BESAR KAS BON VENDOR</h2>
        <p><strong>{{ $grup->nama_grup }}</strong> | Tgl Cetak: {{ date('d/m/Y H:i') }}</p>
    </div>

    <p style="font-size: 14px;"><strong>Sisa Pinjaman Terakhir:</strong> <span class="text-danger fw-bold">Rp {{ number_format($pinjaman ? $pinjaman->sisa_kasbon : 0, 0, ',', '.') }}</span></p>

    <table>
        <thead>
            <tr>
                <th width="5%" class="text-center">No</th>
                <th width="12%" class="text-center">Tanggal</th>
                <th>Keterangan</th>
                <th class="text-end">Debit (Hutang +)</th>
                <th class="text-end">Kredit (Pelunasan -)</th>
                <th class="text-end">Saldo Berjalan</th>
            </tr>
        </thead>
        <tbody>
            @php $saldo = 0; @endphp
            @forelse($mutasis as $index => $mutasi)
                @php
                    if ($mutasi->jenis == 'pinjaman') {
                        $saldo += $mutasi->nominal;
                    } else {
                        $saldo -= $mutasi->nominal;
                    }
                @endphp
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td class="text-center">{{ \Carbon\Carbon::parse($mutasi->tanggal)->format('d/m/Y') }}</td>
                    <td>
                        @if($mutasi->jenis == 'pinjaman')
                            <strong>Pinjaman Baru</strong> ({{ $mutasi->owner->nama ?? '-' }})
                        @elseif($mutasi->jenis == 'potongan')
                            <strong>Potongan dari Slip Gaji</strong>
                        @elseif($mutasi->jenis == 'pelunasan_cash')
                            <strong>Pelunasan Cash</strong>
                        @endif
                        <br>
                        <span style="color:#666">{{ $mutasi->keterangan ?? '-' }}</span>
                        @if($mutasi->slip_pembayaran_id)
                            <br><span>Slip: {{ $mutasi->slipPembayaran->nomor_slip }}</span>
                        @endif
                    </td>
                    <td class="text-end text-danger">
                        {{ $mutasi->jenis == 'pinjaman' ? number_format($mutasi->nominal, 0, ',', '.') : '-' }}
                    </td>
                    <td class="text-end text-success">
                        {{ $mutasi->jenis != 'pinjaman' ? number_format($mutasi->nominal, 0, ',', '.') : '-' }}
                    </td>
                    <td class="text-end fw-bold">
                        {{ number_format($saldo, 0, ',', '.') }}
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="text-center">Belum ada riwayat mutasi untuk grup ini.</td>
                </tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr>
                <td colspan="5" class="text-end fw-bold">Total Sisa Saldo Akhir:</td>
                <td class="text-end fw-bold">Rp {{ number_format($saldo, 0, ',', '.') }}</td>
            </tr>
        </tfoot>
    </table>

    <div class="page-break"></div>

    <!-- HALAMAN 2: LAMPIRAN BUKTI PINJAMAN -->
    @php
        $pinjamansDenganBukti = $mutasis->where('jenis', 'pinjaman')->whereNotNull('bukti_transfer');
    @endphp

    @if($pinjamansDenganBukti->count() > 0)
        <div class="header">
            <h2>LAMPIRAN BUKTI TRANSFER PINJAMAN</h2>
            <p>Vendor: <strong>{{ $grup->nama_grup }}</strong></p>
        </div>

        <div class="lampiran-section">
            @foreach($pinjamansDenganBukti as $p)
                <div class="bukti-box">
                    <img src="{{ asset($p->bukti_transfer) }}" alt="Bukti Transfer">
                    <p class="fw-bold mb-0">Tgl: {{ \Carbon\Carbon::parse($p->tanggal)->format('d/m/Y') }}</p>
                    <p class="text-danger fw-bold">Rp {{ number_format($p->nominal, 0, ',', '.') }}</p>
                    <p style="font-size: 10px;">{{ $p->keterangan ?? 'Pinjaman Baru' }}</p>
                </div>
            @endforeach
        </div>
        <div class="page-break"></div>
    @endif

    <!-- HALAMAN 3: LAMPIRAN POTONGAN SLIP -->
    @php
        $potongans = $mutasis->where('jenis', 'potongan')->whereNotNull('slip_pembayaran_id');
    @endphp

    @if($potongans->count() > 0)
        <div class="header">
            <h2>LAMPIRAN RINCIAN POTONGAN SLIP TAGIHAN</h2>
            <p>Vendor: <strong>{{ $grup->nama_grup }}</strong></p>
        </div>

        <div class="lampiran-section">
            @foreach($potongans as $pot)
                @php $slip = $pot->slipPembayaran; @endphp
                @if($slip)
                    <div class="slip-box">
                        <div class="slip-header">
                            No Slip: {{ $slip->nomor_slip }} | Tanggal: {{ \Carbon\Carbon::parse($slip->tanggal)->format('d/m/Y') }}
                        </div>
                        
                        <table class="trip-table">
                            <thead>
                                <tr>
                                    <th width="15%">Tgl Trip</th>
                                    <th width="15%">Plat Nomor</th>
                                    <th>Rute (Kuari - Proyek)</th>
                                    <th width="10%" class="text-end">Volume</th>
                                    <th width="15%" class="text-end">Harga/Vol</th>
                                    <th width="15%" class="text-end">Total Harga</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($slip->trips as $trip)
                                    @php
                                        $kuari = $trip->lokasiKuari->nama_lokasi ?? '-';
                                        $proyek = $trip->proyekLokasi->lokasiProyek->nama_lokasi ?? '-';
                                        $subtotal = $trip->volume * $trip->harga_bayar;
                                    @endphp
                                    <tr>
                                        <td>{{ \Carbon\Carbon::parse($trip->tanggal_bongkar)->format('d/m/y') }}</td>
                                        <td>{{ $trip->plat_nomor }}</td>
                                        <td>{{ $kuari }} - {{ $proyek }}</td>
                                        <td class="text-end">{{ number_format($trip->volume, 2, ',', '.') }}</td>
                                        <td class="text-end">{{ number_format($trip->harga_bayar, 0, ',', '.') }}</td>
                                        <td class="text-end">{{ number_format($subtotal, 0, ',', '.') }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center">Tidak ada detail trip.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>

                        <div class="clearfix">
                            <table class="summary-table">
                                <tr>
                                    <td>Nilai Kotor (Total Ongkos Trip)</td>
                                    <td class="text-end">Rp {{ number_format($slip->total_trip_ongkos, 0, ',', '.') }}</td>
                                </tr>
                                <tr>
                                    <td>Potongan Material</td>
                                    <td class="text-end text-danger">- Rp {{ number_format($slip->potongan_material, 0, ',', '.') }}</td>
                                </tr>
                                <tr class="total-row">
                                    <td>Nilai Bersih Hak Vendor</td>
                                    <td class="text-end">Rp {{ number_format($slip->total_bersih_dibayar + $slip->potongan_kasbon, 0, ',', '.') }}</td>
                                </tr>
                                <tr>
                                    <td><strong>Potongan Kasbon (Sesuai Mutasi)</strong></td>
                                    <td class="text-end text-danger"><strong>- Rp {{ number_format($pot->nominal, 0, ',', '.') }}</strong></td>
                                </tr>
                                <tr class="total-row">
                                    <td>Total Cash Keluar</td>
                                    <td class="text-end fw-bold">Rp {{ number_format(($slip->total_bersih_dibayar + $slip->potongan_kasbon) - $pot->nominal, 0, ',', '.') }}</td>
                                </tr>
                            </table>
                        </div>
                    </div>
                @endif
            @endforeach
        </div>
    @endif

</body>
</html>
