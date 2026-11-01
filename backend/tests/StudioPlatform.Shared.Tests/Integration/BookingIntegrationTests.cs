using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using StudioPlatform.Modules.Agenda;
using StudioPlatform.Modules.Employees;
using Xunit;

namespace StudioPlatform.Shared.Tests.Integration;

public sealed class BookingIntegrationTests : IClassFixture<StudioPlatformApiFactory>
{
    private readonly StudioPlatformApiFactory _factory;

    public BookingIntegrationTests(StudioPlatformApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CompleteBookingFlow_CreateEmployee_SetSchedule_FetchSlots_BookReservation()
    {
        var businessId = Guid.NewGuid();
        var websiteId = Guid.NewGuid();
        var client = _factory.CreateAuthenticatedClient(businessId, websiteId, role: "BusinessAdmin");

        // 1. Create Employee
        var employee = new EmployeeProfile
        {
            DisplayName = "Sarah Nail Artist",
            Email = "sarah@nails.test",
            RoleTitle = "Master Technician",
            AssignedWebsiteIds = [websiteId],
            IsActive = true
        };

        var createEmpResponse = await client.PostAsJsonAsync("/api/employees", employee);
        Assert.Equal(HttpStatusCode.Created, createEmpResponse.StatusCode);

        var createdEmployee = await createEmpResponse.Content.ReadFromJsonAsync<EmployeeProfile>();
        Assert.NotNull(createdEmployee);
        Assert.NotEqual(Guid.Empty, createdEmployee.Id);
        var employeeId = createdEmployee.Id;

        // 2. Set Employee Schedule
        var targetDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));
        var schedule = new EmployeeWeeklySchedule
        {
            EmployeeId = employeeId,
            WebsiteId = websiteId,
            Windows =
            [
                new ScheduleWindow
                {
                    Day = targetDate.DayOfWeek,
                    StartTime = new TimeOnly(9, 0),
                    EndTime = new TimeOnly(17, 0),
                    BreakStart = new TimeOnly(13, 0),
                    BreakEnd = new TimeOnly(14, 0)
                }
            ]
        };

        var setScheduleResponse = await client.PutAsJsonAsync($"/api/employees/{employeeId}/schedule", schedule);
        Assert.Equal(HttpStatusCode.OK, setScheduleResponse.StatusCode);

        // 3. Fetch Availability Slots
        var slotsUrl = $"/api/agenda/slots?resourceId={employeeId}&date={targetDate:yyyy-MM-dd}&durationMinutes=60";
        var slotsResponse = await client.GetAsync(slotsUrl);
        Assert.Equal(HttpStatusCode.OK, slotsResponse.StatusCode);

        var slots = await slotsResponse.Content.ReadFromJsonAsync<List<AvailableSlot>>();
        Assert.NotNull(slots);
        Assert.NotEmpty(slots);
        Assert.All(slots, s => Assert.Equal(employeeId, s.ResourceId));

        // 4. Book Reservation
        var selectedSlot = slots.First();
        var clientId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();

        var reservationRequest = new Reservation
        {
            ResourceId = employeeId,
            ClientId = clientId,
            StartAtUtc = selectedSlot.StartTimeUtc,
            EndAtUtc = selectedSlot.EndTimeUtc,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot
            {
                ServiceId = serviceId,
                ServiceName = "Gel Extensions",
                DurationMinutes = 60,
                Price = 65m
            },
            ClientSnapshot = new ClientSnapshot
            {
                Name = "Jessica Client",
                Email = "jessica@client.test",
                Phone = "+1234567890"
            }
        };

        var bookResponse = await client.PostAsJsonAsync("/api/agenda/reservations", reservationRequest);
        Assert.Equal(HttpStatusCode.Created, bookResponse.StatusCode);

        var createdReservation = await bookResponse.Content.ReadFromJsonAsync<Reservation>();
        Assert.NotNull(createdReservation);
        Assert.NotEqual(Guid.Empty, createdReservation.Id);
        Assert.Equal(nameof(ReservationStatus.Pending), createdReservation.Status);
        Assert.Equal(selectedSlot.StartTimeUtc, createdReservation.StartAtUtc);

        // 5. Verify the slot is no longer in available slots
        var updatedSlotsResponse = await client.GetAsync(slotsUrl);
        var updatedSlots = await updatedSlotsResponse.Content.ReadFromJsonAsync<List<AvailableSlot>>();
        Assert.NotNull(updatedSlots);
        Assert.DoesNotContain(updatedSlots, s => s.StartTimeUtc == selectedSlot.StartTimeUtc);
    }
}

