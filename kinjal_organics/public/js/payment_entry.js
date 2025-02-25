frappe.ui.form.on('Payment Entry', {
    refresh: function (frm) {
        let user_roles = frappe.user_roles; // Gets the roles of the current user
        // console.log(user_roles); // Use console.log instead of print
        for(var i = 0; i < user_roles.length; i++) {
            if(user_roles[i] == "Payment Pay"){
                frm.set_value('payment_type', 'Pay');
                frm.set_df_property('payment_type', 'read_only', 1);
            }
            else if(user_roles[i] == "Payment Receive"){
                frm.set_value('payment_type', 'Pay');
                frm.set_df_property('payment_type', 'read_only', 1);
            }
        }
    }
});

  