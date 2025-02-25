frappe.ui.form.on('Purchase Invoice', {
    refresh: function (frm) {
        let user_roles = frappe.user_roles; // Gets the roles of the current user
        // console.log(user_roles); // Use console.log instead of print
        for(var i = 0; i < user_roles.length; i++) {
            if(user_roles[i] == "FIFO Advance"){
                frm.set_df_property('allocate_advances_automatically', 'read_only', 0);
            }
            else{
                frm.set_df_property('allocate_advances_automatically', 'read_only', 1);
            }
        }
    }
})