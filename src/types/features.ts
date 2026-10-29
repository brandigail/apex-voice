/** What this signed-in user may see. Lets a feature be shown to one account before it is released to everyone. */
export interface Features {
  subscriptions: boolean
  /** True when this account is a tester whose activity is recorded for the owner. */
  activityLogged: boolean
}
