'use strict';
const {catalog}=require('./admin');
const {createHandler}=require('./sync-results');
const {createTicketIdentity}=require('../server/security/sync-ticket');
module.exports=createHandler({identity:createTicketIdentity(catalog)});
