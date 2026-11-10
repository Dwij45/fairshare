export type Home = {
  id: string
  name: string
}

export type CreateHomeBody = {
  name: string
}
export type Member = {
  id: string
  name: string
  homeId: string
}
export type CreateMemberBody = {
  name: string
}

export type HomeWithMembers = Home & {
  members: Member[]
}
export type Share = {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}

export type BillRow = {
  id: string
  homeId: string
  title: string
  totalCents: number
}

export type ShareWithMember = Share & {
  memberName: string
}

export type BillWithMembers = Omit<Bill, 'shares'> & {
  shares: ShareWithMember[]
}

export type ShareWithMemberRow = {
  id: string
  billId: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}

export type StoredShare = Share & {
  paymentKey: string | null
}

// Bills
export type ShareRow = {
  id: string
  billId: string
  memberId: string
  amountCents: number
  paidAt: string | null
  paymentKey: string | null
}
export type BalanceRow = {
  memberId: string
  name: string
  outstandingCents: number
}
