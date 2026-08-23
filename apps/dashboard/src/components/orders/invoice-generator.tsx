'use client';

import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { Order } from '@/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface InvoiceGeneratorProps {
    order: Order;
}

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: Record<string, unknown>) => jsPDF;
        lastAutoTable: { finalY: number };
    }
}

export function InvoiceGenerator({ order }: InvoiceGeneratorProps) {
    const generatePDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', pageWidth / 2, 20, { align: 'center' });

        // Invoice Details
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Invoice #: ${order.invoiceNumber || 'Pending'}`, 20, 35);
        doc.text(`Order #: ${order.orderNumber}`, 20, 42);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 20, 49);
        doc.text(`Payment Status: ${order.paymentStatus?.toUpperCase()}`, 20, 56);

        // Company Info (Right side)
        doc.text('Edutechs', pageWidth - 20, 35, { align: 'right' });
        doc.text('Your Company Address', pageWidth - 20, 42, { align: 'right' });
        doc.text('Phone: +880 XXX XXXX', pageWidth - 20, 49, { align: 'right' });

        // Customer Info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', 20, 70);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        if (order.shippingAddress) {
            const addr = order.shippingAddress;
            doc.text(addr.addressLine1 || 'N/A', 20, 77);
            if (addr.city) doc.text(`${addr.city}, ${addr.zone || ''}`, 20, 84);
        }

        // Items Table
        const tableData = order.items?.map((item) => [
            item.productName || 'Product',
            item.sku || 'N/A',
            item.quantity || 1,
            `৳${(item.unitPriceSnapshot || 0).toLocaleString()}`,
            `৳${((item.quantity || 1) * (item.unitPriceSnapshot || 0)).toLocaleString()}`,
        ]) || [];

        doc.autoTable({
            startY: 95,
            head: [['Product', 'SKU', 'Qty', 'Unit Price', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10 },
        });

        // Totals
        const finalY = doc.lastAutoTable.finalY + 10;
        const totalsX = pageWidth - 70;

        doc.setFontSize(10);
        doc.text('Subtotal:', totalsX, finalY);
        doc.text(`৳${(order.subtotal || 0).toLocaleString()}`, pageWidth - 20, finalY, { align: 'right' });

        if (order.shippingMethod) {
            doc.text(`Shipping (${order.shippingMethod}):`, totalsX, finalY + 7);
            doc.text('৳0', pageWidth - 20, finalY + 7, { align: 'right' });
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total:', totalsX, finalY + 14);
        doc.text(`৳${(order.total || 0).toLocaleString()}`, pageWidth - 20, finalY + 14, { align: 'right' });

        // Footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Thank you for your business!', pageWidth / 2, finalY + 35, { align: 'center' });

        // Save
        const filename = `invoice-${order.invoiceNumber || order.orderNumber || 'draft'}.pdf`;
        doc.save(filename);
    };

    if (!order.invoiceNumber) {
        return (
            <div className="p-4 bg-muted/5 rounded-xl border border-dashed border-border text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                    Invoice will be available once payment is confirmed
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 p-6 bg-muted/5 rounded-xl border border-border">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-black text-lg">Invoice</h3>
                    <p className="text-sm text-muted-foreground font-mono">{order.invoiceNumber}</p>
                </div>
                <Button
                    onClick={generatePDF}
                    className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </div>
            <div className="p-4 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">
                    Click download to generate a shareable PDF invoice for this order.
                </p>
            </div>
        </div>
    );
}
