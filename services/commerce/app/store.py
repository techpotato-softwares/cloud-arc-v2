from __future__ import annotations

from datetime import datetime

from app.models import EmailMessage, Entitlement, Lead, Order


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _parse_optional_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


class MemoryCommerceStore:
    def __init__(self) -> None:
        self.leads: dict[str, Lead] = {}
        self.orders: dict[str, Order] = {}
        self.entitlements_by_order: dict[str, Entitlement] = {}
        self.entitlements_by_token: dict[str, Entitlement] = {}
        self.emails: list[EmailMessage] = []

    def put_lead(self, lead: Lead) -> None:
        self.leads[lead.id] = lead

    def put_order(self, order: Order) -> None:
        self.orders[order.id] = order

    def get_order(self, order_id: str) -> Order | None:
        return self.orders.get(order_id)

    def save_order(self, order: Order) -> None:
        self.orders[order.id] = order

    def get_entitlement_by_order(self, order_id: str) -> Entitlement | None:
        return self.entitlements_by_order.get(order_id)

    def get_entitlement_by_token(self, token: str) -> Entitlement | None:
        return self.entitlements_by_token.get(token)

    def put_entitlement(self, entitlement: Entitlement) -> None:
        self.entitlements_by_order[entitlement.order_id] = entitlement
        self.entitlements_by_token[entitlement.token] = entitlement

    def put_email(self, message: EmailMessage) -> None:
        self.emails.append(message)

    def save_email(self, message: EmailMessage) -> None:
        return None

    def recent_paid_orders(self, limit: int = 8) -> list[Order]:
        paid = [order for order in self.orders.values() if order.status == "paid" and order.paid_at]
        paid.sort(key=lambda order: order.paid_at or order.created_at, reverse=True)
        return paid[:limit]

    def email_for(self, address: str) -> EmailMessage | None:
        matches = [message for message in self.emails if message.to_email == address]
        return matches[-1] if matches else None


class DynamoCommerceStore:
    def __init__(self, table_name: str) -> None:
        import boto3

        self.table = boto3.resource("dynamodb").Table(table_name)

    def put_lead(self, lead: Lead) -> None:
        self.table.put_item(
            Item={
                "pk": f"LEAD#{lead.id}",
                "sk": "META",
                "id": lead.id,
                "email": lead.email,
                "whatsapp": lead.whatsapp,
                "consent": lead.consent,
                "page": lead.page,
                "followUpStatus": lead.follow_up_status,
                "createdAt": lead.created_at.isoformat(),
            }
        )

    def put_order(self, order: Order) -> None:
        self.table.put_item(Item=self._order_item(order))

    def get_order(self, order_id: str) -> Order | None:
        item = self.table.get_item(Key={"pk": f"ORDER#{order_id}", "sk": "META"}).get("Item")
        return self._order_from_item(item) if item else None

    def save_order(self, order: Order) -> None:
        self.put_order(order)

    def get_entitlement_by_order(self, order_id: str) -> Entitlement | None:
        response = self.table.query(
            IndexName="gsi1",
            KeyConditionExpression="gsi1pk = :pk AND gsi1sk = :sk",
            ExpressionAttributeValues={
                ":pk": f"ORDER#{order_id}",
                ":sk": "ENTITLEMENT",
            },
            Limit=1,
        )
        items = response.get("Items", [])
        return self._entitlement_from_item(items[0]) if items else None

    def get_entitlement_by_token(self, token: str) -> Entitlement | None:
        item = self.table.get_item(Key={"pk": f"TOKEN#{token}", "sk": "META"}).get("Item")
        return self._entitlement_from_item(item) if item else None

    def put_entitlement(self, entitlement: Entitlement) -> None:
        self.table.put_item(
            Item={
                "pk": f"TOKEN#{entitlement.token}",
                "sk": "META",
                "gsi1pk": f"ORDER#{entitlement.order_id}",
                "gsi1sk": "ENTITLEMENT",
                "id": entitlement.id,
                "orderId": entitlement.order_id,
                "token": entitlement.token,
                "email": entitlement.email,
                "artifacts": entitlement.artifacts,
            }
        )

    def put_email(self, message: EmailMessage) -> None:
        self.table.put_item(Item=self._email_item(message))

    def save_email(self, message: EmailMessage) -> None:
        self.put_email(message)

    def recent_paid_orders(self, limit: int = 8) -> list[Order]:
        response = self.table.query(
            IndexName="gsi1",
            KeyConditionExpression="gsi1pk = :pk",
            ExpressionAttributeValues={":pk": "PAID"},
            ScanIndexForward=False,
            Limit=limit,
        )
        return [self._order_from_item(item) for item in response.get("Items", [])]

    def email_for(self, address: str) -> EmailMessage | None:
        response = self.table.query(
            IndexName="gsi1",
            KeyConditionExpression="gsi1pk = :pk",
            ExpressionAttributeValues={":pk": f"TO#{address}"},
            ScanIndexForward=False,
            Limit=1,
        )
        items = response.get("Items", [])
        return self._email_from_item(items[0]) if items else None

    @staticmethod
    def _order_item(order: Order) -> dict:
        item = {
            "pk": f"ORDER#{order.id}",
            "sk": "META",
            "id": order.id,
            "planId": order.plan_id,
            "planName": order.plan_name,
            "provider": order.provider,
            "email": order.email,
            "buyerName": order.buyer_name,
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "providerReference": order.provider_reference,
            "createdAt": order.created_at.isoformat(),
        }
        if order.paid_at is not None:
            item["paidAt"] = order.paid_at.isoformat()
            item["gsi1pk"] = "PAID"
            item["gsi1sk"] = f"{order.paid_at.isoformat()}#{order.id}"
        return item

    @staticmethod
    def _order_from_item(item: dict) -> Order:
        return Order(
            id=item["id"],
            plan_id=item["planId"],
            plan_name=item["planName"],
            provider=item["provider"],
            email=item["email"],
            buyer_name=item["buyerName"],
            amount=int(item["amount"]),
            currency=item["currency"],
            status=item["status"],
            provider_reference=item.get("providerReference", ""),
            created_at=_parse_time(item["createdAt"]),
            paid_at=_parse_optional_time(item.get("paidAt")),
        )

    @staticmethod
    def _entitlement_from_item(item: dict) -> Entitlement:
        return Entitlement(
            id=item["id"],
            order_id=item["orderId"],
            token=item["token"],
            email=item["email"],
            artifacts=item["artifacts"],
        )

    @staticmethod
    def _email_item(message: EmailMessage) -> dict:
        return {
            "pk": f"EMAIL#{message.id}",
            "sk": "META",
            "gsi1pk": f"TO#{message.to_email}",
            "gsi1sk": message.created_at.isoformat(),
            "id": message.id,
            "orderId": message.order_id,
            "toEmail": message.to_email,
            "subject": message.subject,
            "body": message.body,
            "status": message.status,
            "createdAt": message.created_at.isoformat(),
        }

    @staticmethod
    def _email_from_item(item: dict) -> EmailMessage:
        return EmailMessage(
            id=item["id"],
            order_id=item["orderId"],
            to_email=item["toEmail"],
            subject=item["subject"],
            body=item["body"],
            status=item["status"],
            created_at=_parse_time(item["createdAt"]),
        )
