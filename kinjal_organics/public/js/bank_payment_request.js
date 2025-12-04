frappe.ui.form.on("Bank Payment Request", {
    validate: async function(frm) {

        // Fetch Supplier Doc (to check allow_advance & advance_limit)
        const supplier = await frappe.db.get_value(
            "Supplier",
            frm.doc.party,
            ["allow_advance_payment", "advance_limit"]
        );

        let allow_advance = supplier?.message?.allow_advance_payment;
        let advance_limit = supplier?.message?.advance_limit || 0;

       

       
        const invoices = await frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Purchase Invoice",
                filters: {
                    supplier: frm.doc.party,
                    company: frm.doc.company,
                    outstanding_amount: [">", 0],
                    posting_date: ["<=", frm.doc.transaction_date],
                    docstatus: 1
                },
                fields: ["name", "posting_date", "grand_total"]
            }
        });

        let total_amount = 0;

        invoices.message.forEach(inv => {
            total_amount += flt(inv.grand_total);
        });

        const payment = await frappe.call({
            method:"frappe.client.get_list",
            args:{
                doctype:"Payment Entry",
                filters:{
                    party:frm.doc.party,
                    company:frm.doc.company,
                    docstatus: 1
                },
                fields: ["name", "posting_date", "paid_amount"]
            }
        });
        let payment_amount = 0;
        let unpaid_amount = 0;
        let advance_amount = 0;


        payment.message.forEach(pay => {
            payment_amount += flt(pay.paid_amount);
        });
        if(total_amount >= payment_amount){
            unpaid_amount = total_amount - payment_amount
        }
        else{
            advance_amount = Math.abs(total_amount - payment_amount)
        }
        // console.log(unpaid_amount)
        if (!allow_advance) {
            // Advance NOT allowed → strict check
            if (frm.doc.net_total > Math.round(unpaid_amount)) {
                frappe.throw("The amount paid cannot exceed the supplier's outstanding amount.");
            }
        } else {
            // Advance allowed → check advance limit (optional)
            if (frm.doc.net_total > Math.round(unpaid_amount + advance_limit)) {
                frappe.throw(
                    `Allowed advance limit exceeded. 
                    Outstanding: ${Math.round(unpaid_amount)}  
                    Advance Limit: ${advance_limit}`
                );
            }
        }
    }
});
