def can_manage(user, event):
    return (
        user.is_authenticated
        and user.has_perm("events.change_event")
        and (event.organizer_id == user.pk or user.has_perm("events.manage_all_events"))
    )


def can_view_draft(user, event):
    return user.is_authenticated and (
        (
            event.organizer_id == user.pk
            and (
                user.has_perm("events.change_event")
                or user.has_perm("events.publish_event")
            )
        )
        or user.has_perm("events.manage_all_events")
    )
