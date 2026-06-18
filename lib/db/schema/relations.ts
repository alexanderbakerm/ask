import { relations } from "drizzle-orm";
import {
	accountTable,
	aiChatTable,
	billingEventTable,
	catalogColumnTable,
	catalogTableTable,
	creditBalanceTable,
	creditDeductionFailureTable,
	creditTransactionTable,
	dataSourceTable,
	invitationTable,
	leadTable,
	memberTable,
	orderItemTable,
	orderTable,
	organizationTable,
	queryRunTable,
	savedQueryTable,
	sessionTable,
	subscriptionItemTable,
	subscriptionTable,
	twoFactorTable,
	userTable,
} from "./tables";

export const accountRelations = relations(accountTable, ({ one }) => ({
	user: one(userTable, {
		fields: [accountTable.userId],
		references: [userTable.id],
	}),
}));

export const invitationRelations = relations(invitationTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [invitationTable.organizationId],
		references: [organizationTable.id],
	}),
	inviter: one(userTable, {
		fields: [invitationTable.inviterId],
		references: [userTable.id],
	}),
}));

export const memberRelations = relations(memberTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [memberTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [memberTable.userId],
		references: [userTable.id],
	}),
}));

export const organizationRelations = relations(
	organizationTable,
	({ one, many }) => ({
		members: many(memberTable),
		invitations: many(invitationTable),
		subscriptions: many(subscriptionTable),
		orders: many(orderTable),
		billingEvents: many(billingEventTable),
		aiChats: many(aiChatTable),
		leads: many(leadTable),
		creditBalance: one(creditBalanceTable),
		creditTransactions: many(creditTransactionTable),
		dataSources: many(dataSourceTable),
		queryRuns: many(queryRunTable),
		savedQueries: many(savedQueryTable),
	}),
);

export const sessionRelations = relations(sessionTable, ({ one }) => ({
	user: one(userTable, {
		fields: [sessionTable.userId],
		references: [userTable.id],
	}),
}));

export const twoFactorRelations = relations(twoFactorTable, ({ one }) => ({
	user: one(userTable, {
		fields: [twoFactorTable.userId],
		references: [userTable.id],
	}),
}));

export const userRelations = relations(userTable, ({ many }) => ({
	sessions: many(sessionTable),
	accounts: many(accountTable),
	invitations: many(invitationTable),
	memberships: many(memberTable),
	twoFactors: many(twoFactorTable),
	aiChats: many(aiChatTable),
	assignedLeads: many(leadTable),
	creditTransactions: many(creditTransactionTable),
	dataSources: many(dataSourceTable),
	queryRuns: many(queryRunTable),
	savedQueries: many(savedQueryTable),
}));

// Billing relations
export const subscriptionRelations = relations(
	subscriptionTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [subscriptionTable.organizationId],
			references: [organizationTable.id],
		}),
		items: many(subscriptionItemTable),
	}),
);

export const subscriptionItemRelations = relations(
	subscriptionItemTable,
	({ one }) => ({
		subscription: one(subscriptionTable, {
			fields: [subscriptionItemTable.subscriptionId],
			references: [subscriptionTable.id],
		}),
	}),
);

export const orderRelations = relations(orderTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [orderTable.organizationId],
		references: [organizationTable.id],
	}),
	items: many(orderItemTable),
}));

export const orderItemRelations = relations(orderItemTable, ({ one }) => ({
	order: one(orderTable, {
		fields: [orderItemTable.orderId],
		references: [orderTable.id],
	}),
}));

export const billingEventRelations = relations(
	billingEventTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [billingEventTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

// AI Chat relations
export const aiChatRelations = relations(aiChatTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [aiChatTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [aiChatTable.userId],
		references: [userTable.id],
	}),
	queryRuns: many(queryRunTable),
}));

// Lead relations
export const leadRelations = relations(leadTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [leadTable.organizationId],
		references: [organizationTable.id],
	}),
	assignedTo: one(userTable, {
		fields: [leadTable.assignedToId],
		references: [userTable.id],
	}),
}));

// Credit relations
export const creditBalanceRelations = relations(
	creditBalanceTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditBalanceTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

export const creditTransactionRelations = relations(
	creditTransactionTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditTransactionTable.organizationId],
			references: [organizationTable.id],
		}),
		createdByUser: one(userTable, {
			fields: [creditTransactionTable.createdBy],
			references: [userTable.id],
		}),
	}),
);

export const creditDeductionFailureRelations = relations(
	creditDeductionFailureTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditDeductionFailureTable.organizationId],
			references: [organizationTable.id],
		}),
		user: one(userTable, {
			fields: [creditDeductionFailureTable.userId],
			references: [userTable.id],
			relationName: "deductionFailureUser",
		}),
		resolvedByUser: one(userTable, {
			fields: [creditDeductionFailureTable.resolvedBy],
			references: [userTable.id],
			relationName: "deductionFailureResolvedBy",
		}),
	}),
);

// AskBI relations
export const dataSourceRelations = relations(
	dataSourceTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [dataSourceTable.organizationId],
			references: [organizationTable.id],
		}),
		createdByUser: one(userTable, {
			fields: [dataSourceTable.createdBy],
			references: [userTable.id],
		}),
		catalogTables: many(catalogTableTable),
		queryRuns: many(queryRunTable),
		savedQueries: many(savedQueryTable),
	}),
);

export const catalogTableRelations = relations(
	catalogTableTable,
	({ one, many }) => ({
		dataSource: one(dataSourceTable, {
			fields: [catalogTableTable.dataSourceId],
			references: [dataSourceTable.id],
		}),
		organization: one(organizationTable, {
			fields: [catalogTableTable.organizationId],
			references: [organizationTable.id],
		}),
		columns: many(catalogColumnTable),
	}),
);

export const catalogColumnRelations = relations(
	catalogColumnTable,
	({ one }) => ({
		catalogTable: one(catalogTableTable, {
			fields: [catalogColumnTable.catalogTableId],
			references: [catalogTableTable.id],
		}),
		organization: one(organizationTable, {
			fields: [catalogColumnTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

export const queryRunRelations = relations(queryRunTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [queryRunTable.organizationId],
		references: [organizationTable.id],
	}),
	dataSource: one(dataSourceTable, {
		fields: [queryRunTable.dataSourceId],
		references: [dataSourceTable.id],
	}),
	user: one(userTable, {
		fields: [queryRunTable.userId],
		references: [userTable.id],
	}),
	chat: one(aiChatTable, {
		fields: [queryRunTable.chatId],
		references: [aiChatTable.id],
	}),
}));

export const savedQueryRelations = relations(savedQueryTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [savedQueryTable.organizationId],
		references: [organizationTable.id],
	}),
	dataSource: one(dataSourceTable, {
		fields: [savedQueryTable.dataSourceId],
		references: [dataSourceTable.id],
	}),
	user: one(userTable, {
		fields: [savedQueryTable.userId],
		references: [userTable.id],
	}),
}));
