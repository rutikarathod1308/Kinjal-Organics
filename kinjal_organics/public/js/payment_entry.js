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




// frappe.ui.form.on('Payment Entry', {
//     validate: async function (frm) {
//         if (cur_frm.doc.party_type === "Customer" && frm.doc.payment_type === "Receive") {
//             let r = await frappe.call({
//                 method: 'kinjal_organics.public.py.payment_entry.get_customer_payment_permission',
//                 args: {
//                     customer: frm.doc.party
//                 }
//             });
            
//             if (frm.doc.paid_amount > frm.doc.total_allocated_amount) {
//                 frappe.throw("The amount paid cannot exceed the total allocated amount.");
//             }
//         }
//       if (frm.doc.party_type == "Supplier" && frm.doc.payment_type === "Pay") {

//     let r = await frappe.call({
//         method: "kinjal_organics.public.py.payment_entry.get_supplier_payment_permission",
//         args: {
//             supplier: frm.doc.party
//         }
//     });

//     const data = r.message || {};

//     const allow_advance = data.allow_advance_payment || 0;
//     const allow_once = data.allow_one_time_advance || 0;
//     const advance_limit = data.advance_limit || 0;

//     const party_balance = Math.abs(frm.doc.party_balance) || 0;
//     const paid_amount = Math.abs(frm.doc.paid_amount) || 0;
//     const unallocated_amount = Math.abs(frm.doc.unallocated_amount) || 0;

//     // ----------------------------------------------------------
//     // CASE: Advance NOT allowed (both flags are 0)
//     // ----------------------------------------------------------
    // if (allow_advance === 0 && allow_once === 0) {

        // if (unallocated_amount > 0) {
        //     frappe.throw("Advance is not permitted because both advance options are disabled.");
        // }

    //     return; // Do not continue to next logic
    // }

//     // ----------------------------------------------------------
//     //  CASE: Advance allowed (either one is enabled)
//     // ----------------------------------------------------------
    // const new_total = paid_amount + unallocated_amount;
    //  console.log(advance_limit)
    // if (unallocated_amount > advance_limit) {
       
    //     frappe.throw("The amount paid cannot exceed the Advance limit.");
    // }
// }


//     }
// });

frappe.ui.form.on('Payment Entry', {
    validate: async function (frm) {
        if (cur_frm.doc.party_type === "Customer" && frm.doc.payment_type === "Receive") {
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
      if (frm.doc.party_type == "Supplier" && frm.doc.payment_type === "Pay") {

    let r = await frappe.call({
        method: "kinjal_organics.public.py.payment_entry.get_supplier_payment_permission",
        args: {
            supplier: frm.doc.party
        }
    });

    const data = r.message || {};
    console.log(data)
    const allow_advance = data.supplier_data.allow_advance_payment || 0;
    const allow_once = data.supplier_data.allow_one_time_advance || 0;
    const payment_data = data.payment_data || 0;
    const advance_limit = data.supplier_data.advance_limit || 0;
    const unallocated_amount = Math.abs(frm.doc.unallocated_amount) || 0;
       if (allow_advance === 0 && allow_once === 0) {

       if (unallocated_amount > 0) {
            frappe.throw("Advance is not permitted because both advance options are disabled.");
        }
        

        return; // Do not continue to next logic
    }
    const new_total = frm.doc.unallocated_amount + payment_data;
    console.log(new_total)
    if (new_total > advance_limit) {
       
        frappe.throw("The amount paid cannot exceed the Advance limit.");
    }
   
}


    }
});




