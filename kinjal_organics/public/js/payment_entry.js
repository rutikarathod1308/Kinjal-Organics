frappe.ui.form.on('Payment Entry', {
    refresh: function (frm) {
        // Reset to editable by default
      
        frm.set_df_property('payment_type', 'read_only', 0);

        // Call server to get role-based permission
        frappe.call({
            method: 'kinjal_organics.public.py.payment_entry.get_selected_enabled_roles',
            callback: function (r) {
                const role_type = r.message;
  
                if (role_type === "Pay") {
                      if(frm.is_new()){
                    frm.set_value('payment_type', 'Pay');
                      }
                    frm.set_df_property('payment_type', 'read_only', 1);
                } else if (role_type === "Receive") {
                      if(frm.is_new()){
                    frm.set_value('payment_type', 'Receive');
                      }
                    frm.set_df_property('payment_type', 'read_only', 1);
                }

                frm.refresh_field('payment_type');
            }
        });
    
    }
});




frappe.ui.form.on('Payment Entry', {
    validate: async function (frm) {
        if (frm.doc.party_type === "Customer") {
            let r = await frappe.call({
                method: 'kinjal_organics.public.py.payment_entry.get_customer_payment_permission',
                args: {
                    customer: frm.doc.party
                }
            });
            
            if (frm.doc.paid_amount > frm.doc.total_allocated_amount) {
                frappe.throw("The amount paid cannot exceed the total allocated amount.");
            }
        }
      if (frm.doc.party_type == "Supplier") {

    let r = await frappe.call({
        method: "kinjal_organics.public.py.payment_entry.get_supplier_payment_permission",
        args: {
            supplier: frm.doc.party
        }
    });

    const data = r.message || {};

    const allow_advance = data.allow_advance_payment || 0;
    const allow_once = data.allow_one_time_advance || 0;
    const advance_limit = data.advance_limit || 0;

    const party_balance = Math.abs(frm.doc.party_balance) || 0;
    const paid_amount = Math.abs(frm.doc.paid_amount) || 0;

    // ----------------------------------------------------------
    // 1️⃣ CASE: Advance NOT allowed (both flags are 0)
    // ----------------------------------------------------------
    if (allow_advance === 0 && allow_once === 0) {

        if (paid_amount > party_balance) {
            frappe.throw("Advance is not permitted because both advance options are disabled.");
        }

        return; // Do not continue to next logic
    }

    // ----------------------------------------------------------
    // 2️⃣ CASE: Advance allowed (either one is enabled)
    // ----------------------------------------------------------
    const new_total = party_balance + paid_amount;

    if (new_total > advance_limit) {
        frappe.throw("The amount paid cannot exceed the Advance limit.");
    }
}


    }
});




