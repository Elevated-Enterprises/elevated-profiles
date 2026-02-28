using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Tests;

[TestClass]
public sealed class ModelTests
{
    [TestMethod]
    public void User_DefaultValues_AreCorrect()
    {
        var user = new User();

        Assert.AreEqual(Visibility.Private, user.Visibility);
        Assert.IsNull(user.ProfileImageFilename);
        Assert.IsNull(user.AlternativeName);
        Assert.IsNull(user.DateOfBirth);
        Assert.IsNull(user.Country);
        Assert.IsNull(user.City);
        Assert.IsNull(user.Bio);
        Assert.IsFalse(user.IsAdmin);
    }

    [TestMethod]
    public void Companion_DefaultValues_AreCorrect()
    {
        var companion = new Companion();

        Assert.AreEqual(Visibility.Private, companion.Visibility);
        Assert.IsNull(companion.ProfileImageFilename);
        Assert.IsNull(companion.Platform);
        Assert.IsNull(companion.Role);
        Assert.IsNull(companion.DateOfBirth);
        Assert.IsNull(companion.Bio);
    }

    [TestMethod]
    public void Visibility_HasExpectedValues()
    {
        Assert.AreEqual(0, (int)Visibility.Private);
        Assert.AreEqual(1, (int)Visibility.MembersOnly);
        Assert.AreEqual(2, (int)Visibility.Public);
    }

    [TestMethod]
    public void AuditLogEntry_DefaultTimestamp_IsReasonable()
    {
        var entry = new AuditLogEntry();

        var diff = DateTime.UtcNow - entry.Timestamp;
        Assert.IsTrue(diff.TotalSeconds < 5, "Timestamp should be close to current time");
    }
}
