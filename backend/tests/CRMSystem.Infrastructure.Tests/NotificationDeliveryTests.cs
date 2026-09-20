using CRMSystem.Domain.Entities;
using Xunit;

namespace CRMSystem.Infrastructure.Tests;

public sealed class NotificationDeliveryTests
{
    [Fact]
    public void New_notification_defaults_to_queued_email()
    {
        var notification = new Notification
        {
            RecipientUserId = Guid.NewGuid(),
            Type = "CrmStatusChanged",
            Subject = "Status changed",
            Body = "<p>Updated.</p>",
        };

        Assert.Equal("Email", notification.Channel);
        Assert.Equal("Queued", notification.Status);
        Assert.False(notification.IsRead);
        Assert.Equal(0, notification.AttemptCount);
        Assert.Null(notification.SentAt);
    }

    [Fact]
    public void Notification_can_target_either_a_user_or_a_bare_email()
    {
        var toUser = new Notification { RecipientUserId = Guid.NewGuid(), Type = "X", Subject = "S", Body = "B" };
        var toEmail = new Notification { RecipientEmail = "client@example.test", Type = "X", Subject = "S", Body = "B" };

        Assert.NotNull(toUser.RecipientUserId);
        Assert.Null(toUser.RecipientEmail);
        Assert.NotNull(toEmail.RecipientEmail);
        Assert.Null(toEmail.RecipientUserId);
    }
}
