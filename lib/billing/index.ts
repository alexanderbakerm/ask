// Re-export all billing functionality

// Checkout sessions
export {
	createCheckoutSession,
	createCheckoutWithCustomer,
	getCheckoutSession,
} from "./checkout";
// Customer management
export {
	getOrCreateStripeCustomer,
	getOrganizationByStripeCustomerId,
	getStripeCustomerByOrganizationId,
	updateStripeCustomer,
} from "./customer";
// Feature guards
export {
	getCurrentPlanInfo,
	getOrganizationPlanLimits,
	isOverMemberLimit,
	requireMemberSlot,
	requirePaidPlan,
	requireSpecificPlan,
} from "./guards";
// Customer portal
export {
	createCustomerPortalSession,
	getPortalConfiguration,
} from "./portal";
// Database queries
export {
	// Types
	type BillingEventInsert,
	type BillingEventSelect,
	// Billing event queries
	billingEventExists,
	createBillingEvent,
	// Order queries
	createOrder,
	// Order item queries
	createOrderItem,
	createOrderItems,
	// Subscription queries
	createSubscription,
	// Subscription item queries
	createSubscriptionItem,
	createSubscriptionItems,
	deleteOrderItemsByOrderId,
	deleteSubscription,
	deleteSubscriptionItem,
	deleteSubscriptionItemsBySubscriptionId,
	// Active plan helpers
	getActivePlanForOrganization,
	getActiveSubscriptionByOrganizationId,
	getBillingEventsByOrganizationId,
	getLifetimeOrderByOrganizationId,
	getOrderByCheckoutSessionId,
	getOrderById,
	getOrderByPaymentIntentId,
	getOrderItemById,
	getOrderItemsByOrderId,
	getOrdersByOrganizationId,
	getSubscriptionById,
	getSubscriptionByStripeCustomerId,
	getSubscriptionItemById,
	getSubscriptionItemsBySubscriptionId,
	getSubscriptionsByOrganizationId,
	hasActivePaidPlan,
	hasSpecificPlan,
	type LifetimeOrderResult,
	markBillingEventError,
	type OrderInsert,
	type OrderItemInsert,
	type OrderItemSelect,
	type OrderSelect,
	type SubscriptionInsert,
	type SubscriptionItemInsert,
	type SubscriptionItemSelect,
	type SubscriptionSelect,
	// Stripe sync helpers
	safeTsToDate,
	stripeItemsToDb,
	stripeSubscriptionToDb,
	// Subscription existence check
	subscriptionExists,
	syncSubscriptionItems,
	updateOrder,
	updateSubscription,
	updateSubscriptionItem,
	upsertBillingEvent,
} from "./queries";
// Core Stripe client
export { getStripe, getWebhookSecret, isStripeConfigured } from "./stripe";
// Subscription management
export {
	cancelSubscriptionAtPeriodEnd,
	cancelSubscriptionImmediately,
	changeSubscriptionPrice,
	getStripeSubscription,
	getUpcomingInvoice,
	listCustomerInvoices,
	listCustomerSubscriptions,
	previewSubscriptionChange,
	reactivateSubscription,
	updateSubscriptionQuantity,
} from "./subscriptions";
// Types
export type {
	ActivePlanInfo,
	BillingEvent,
	CreateCheckoutParams,
	CreatePortalParams,
	Order,
	OrderItem,
	Subscription,
	WebhookEventType,
	WebhookResult,
} from "./types";
