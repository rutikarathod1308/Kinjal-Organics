frappe.ui.form.on('Payment Entry', {
    refresh: function (frm) {
        // Reset to editable by default
      
        frm.set_df_property('payment_type', 'read_only', 0);

        // Call server to get role-based permission
        frappe.call({
            method: 'kinjal_organics.public.py.payment_entry.get_payment_permission_role',
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
            
            if (r.message === "None" && frm.doc.paid_amount > frm.doc.total_allocated_amount) {
                frappe.throw("The amount paid cannot exceed the total allocated amount.");
            }
        }
        if (frm.doc.party_type === "Supplier") {
            let r = await frappe.call({
                method: 'kinjal_organics.public.py.payment_entry.get_supplier_payment_permission',
                args: {
                    supplier: frm.doc.party
                }
            });

            if (r.message === "None" && frm.doc.paid_amount > frm.doc.total_allocated_amount) {
                frappe.throw("The amount paid cannot exceed the total allocated amount.");
            }
        }
    }
});





  // Default: make field editable
        // frm.set_df_property('payment_type', 'read_only', 0);

        // if (user_roles.includes("Payment Pay")) {
        //     frm.set_value('payment_type', 'Pay');
        //     frm.set_df_property('payment_type', 'read_only', 1);
        // } else if (user_roles.includes("Payment Receive")) {
        //     frm.set_value('payment_type', 'Receive');
        //     frm.set_df_property('payment_type', 'read_only', 1);
        // }
        

        // frm.refresh_field('payment_type');