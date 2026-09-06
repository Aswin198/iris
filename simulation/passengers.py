"""Passenger connection risk model.

Each connecting-passenger group carries a `slack_minutes` value: the amount of
flight delay they can absorb before missing their onward connection. A group is
at risk if the delay imposed by the recovery plan exceeds their slack.
"""

from __future__ import annotations

from typing import Iterable, TypedDict


class ConnectionGroup(TypedDict):
    count: int
    slack_minutes: int
    same_terminal: bool


def at_risk_count(connections: Iterable[ConnectionGroup], delay_minutes: int) -> int:
    return sum(g["count"] for g in connections if delay_minutes > g["slack_minutes"])


def hard_mct_violations(connections: Iterable[ConnectionGroup], delay_minutes: int) -> int:
    """Passengers whose delay exceeds slack by more than an intra-terminal MCT.

    Used as a hard constraint: if too many pax truly cannot make the connection
    (even by sprinting), the plan is rejected.
    """
    # Same-terminal pax can sprint (~15 min tolerance recovered). Inter-terminal
    # pax rely on a shuttle they cannot skip, so they get no bonus.
    return sum(
        g["count"]
        for g in connections
        if delay_minutes > g["slack_minutes"] + (15 if g["same_terminal"] else 0)
    )
